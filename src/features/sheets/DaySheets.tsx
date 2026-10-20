import { useState } from 'react';
import { nowTime, toIsoDate } from '../../domain/dates';
import { classifyDay } from '../../domain/nutrition';
import {
  FOCUS_OPTIONS, TRAINING_INTENSITY_HINT, TRAINING_INTENSITY_LABEL, TRAINING_KIND_HINT,
  TRAINING_KIND_LABEL, normalizeSession, sessionExtraKcal, sessionKcal, trainingDemand,
  usesDistance, usesSetsAndReps,
} from '../../domain/training';
import {
  DAY_TYPE_LABEL, type Digestion, type Hunger, type TrainingIntensity, type TrainingKind,
  type TrainingSession, type TrainingSet,
} from '../../domain/types';
import { EstimateNotice, Field, NumberInput, Sheet, Segmented, g } from '../../ui/components';
import { useUI } from '../../ui/shell';
import { useApp } from '../store';
import { Icon } from '../../ui/icons';

/** Hambre, digestión, pasos y calorías del reloj. Todo opcional. */
export function DayStateSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const day = app.day;
  const [steps, setSteps] = useState<number | ''>(day?.steps ?? '');
  const [deviceKcal, setDeviceKcal] = useState<number | ''>(day?.deviceKcal ?? '');
  const [note, setNote] = useState(day?.note ?? '');

  const save = async () => {
    await app.actions.patchDay({
      steps: steps === '' ? undefined : steps,
      deviceKcal: deviceKcal === '' ? undefined : deviceKcal,
      note: note.trim() || undefined,
    });
    onClose();
  };

  const projectedType = classifyDay({
    session: day?.training,
    steps: steps === '' ? undefined : steps,
    typicalSteps: app.profile?.typicalSteps ?? 8000,
  });

  return (
    <Sheet title="Contexto de hoy" subtitle="Todo es opcional" onClose={onClose}
      footer={<button className="btn primary" onClick={() => void save()}>Guardar</button>}>

      <Field label="¿Cuánta hambre tienes?">
        <div className="chips">
          {(['high', 'normal', 'low', 'veryLow'] as Hunger[]).map((h) => (
            <button key={h} className="chip" aria-pressed={day?.hunger === h}
              onClick={() => void app.actions.patchDay({ hunger: h })}>
              {HUNGER[h]}
            </button>
          ))}
        </div>
        <div className="hint">
          Con poco apetito la app deja de proponer volumen y pasa a comidas pequeñas y densas.
        </div>
      </Field>

      <Field label="¿Cómo va la digestión?">
        <div className="chips">
          {(['good', 'bloated', 'bad'] as Digestion[]).map((d) => (
            <button key={d} className="chip" aria-pressed={day?.digestion === d}
              onClick={() => void app.actions.patchDay({ digestion: d })}>
              {DIGESTION[d]}
            </button>
          ))}
        </div>
        <div className="hint">
          Si te notas hinchado, se evitan legumbres, crucíferas y cargas altas de fibra, y no se te empuja a
          subir la fibra a cualquier precio.
        </div>
      </Field>

      <Field label="Pasos de hoy" hint="A mano o desde tu app de salud. Cuenta como actividad aunque no entrenes.">
        <NumberInput value={steps} step={500} suffix="pasos" onChange={setSteps} />
      </Field>

      {steps !== '' && (
        <p className="note">
          Con {g(steps)} pasos, hoy cuenta como: <b>{DAY_TYPE_LABEL[projectedType]}</b>.
        </p>
      )}

      <Field label="Calorías que marca tu reloj (opcional)">
        <NumberInput value={deviceKcal} step={50} suffix="kcal" onChange={setDeviceKcal} />
      </Field>
      <EstimateNotice>
        Las calorías estimadas por relojes y pulseras tienen bastante incertidumbre: pueden errar un 20-30%.
        <b> No se suman a tu objetivo.</b> Se guardan como una señal más, junto a los pasos y el entrenamiento.
      </EstimateNotice>

      <Field label="Nota del día (opcional)">
        <textarea className="input" rows={2} value={note} onChange={(e) => setNote(e.target.value)}
          placeholder="Dormí poco, mucho trabajo…" />
      </Field>
    </Sheet>
  );
}

const HUNGER: Record<Hunger, string> = {
  high: 'Mucha', normal: 'Normal', low: 'Poca', veryLow: 'Muy poca',
};
const DIGESTION: Record<Digestion, string> = {
  good: 'Bien', bloated: 'Hinchado', bad: 'Muy incómodo',
};

// ───────────────────────────── Entrenamiento ─────────────────────────────

/**
 * Registro de entrenamiento.
 *
 * Clasifica por TIPO (fuerza, cardio, intervalos, movilidad, deporte) e
 * INTENSIDAD, porque de ahí sale el coste estimado de la sesión: una hora de
 * series con descansos y una hora de intervalos no cuestan lo mismo. La versión
 * anterior asumía fuerza siempre.
 */
export function TrainingSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const existing = app.day?.training ? normalizeSession(app.day.training) : null;

  const [kind, setKind] = useState<TrainingKind>(existing?.kind ?? 'strength');
  const [focus, setFocus] = useState(existing?.focus ?? '');
  const [minutes, setMinutes] = useState<number>(existing?.minutes ?? 55);
  const [intensity, setIntensity] = useState<TrainingIntensity>(existing?.intensity ?? 'moderate');
  const [location, setLocation] = useState<'home' | 'gym' | 'outdoor'>(
    existing?.location ?? (app.profile?.trainingLocation === 'gym' ? 'gym' : 'home'),
  );
  const [performance, setPerformance] = useState<number>(existing?.performance ?? 3);
  const [exercises, setExercises] = useState<TrainingSet[]>(existing?.exercises ?? []);

  // Borrador del ejercicio que se está añadiendo.
  const [exName, setExName] = useState('');
  const [exSets, setExSets] = useState<number>(4);
  const [exReps, setExReps] = useState('10');
  const [exWeight, setExWeight] = useState('');
  const [exDistance, setExDistance] = useState('');

  const weight = app.weights.at(-1)?.kg ?? app.profile?.startWeightKg ?? 66.5;
  const session: TrainingSession = { kind, focus, minutes, intensity, exercises, performance, location };
  const estimated = Math.round(sessionKcal(weight, session));
  const extra = sessionExtraKcal(weight, session);
  const demand = trainingDemand(session);

  const addExercise = () => {
    const name = exName.trim();
    if (name.length < 2) return;
    const entry: TrainingSet = {
      exercise: name,
      sets: usesSetsAndReps(kind) ? Math.max(1, exSets) : 1,
      reps: usesSetsAndReps(kind) ? exReps.trim() || '—' : '—',
      weightKg: exWeight.trim() ? Number(exWeight.replace(',', '.')) : undefined,
      distanceKm: exDistance.trim() ? Number(exDistance.replace(',', '.')) : undefined,
    };
    setExercises((prev) => [...prev, entry]);
    // Se limpia el nombre pero se conservan series y repeticiones: en una
    // sesión casi todos los ejercicios llevan el mismo esquema.
    setExName('');
    setExWeight('');
    setExDistance('');
  };

  const save = async () => {
    await app.actions.patchDay({
      training: { ...session, focus: focus.trim() || FOCUS_OPTIONS[kind][0] },
    });
    onClose();
  };

  return (
    <Sheet
      title="Entrenamiento de hoy"
      subtitle={existing ? 'Editando la sesión de hoy' : undefined}
      onClose={onClose}
      footer={
        <div className="btns">
          {existing ? (
            <button className="btn danger" onClick={async () => { await app.actions.patchDay({ training: undefined }); onClose(); }}>
              Quitar
            </button>
          ) : (
            <button className="btn quiet" onClick={onClose}>Cancelar</button>
          )}
          <button className="btn primary" onClick={() => void save()}>Guardar</button>
        </div>
      }
    >
      {/* ── Tipo ── */}
      <Field label="Tipo de entrenamiento">
        <div className="rows">
          {(Object.keys(TRAINING_KIND_LABEL) as TrainingKind[]).map((k) => (
            <button
              className="row"
              key={k}
              onClick={() => {
                setKind(k);
                // El foco anterior no tiene sentido en otro tipo.
                if (!FOCUS_OPTIONS[k].includes(focus)) setFocus('');
              }}
              style={{ borderLeft: kind === k ? '3px solid var(--accent)' : '3px solid transparent', paddingLeft: 8 }}
            >
              <div className="row-body">
                <div className="row-name" style={{ fontSize: '0.9rem' }}>{TRAINING_KIND_LABEL[k]}</div>
                <div className="row-meta">{TRAINING_KIND_HINT[k]}</div>
              </div>
              {kind === k && <Icon name="check" size={16} />}
            </button>
          ))}
        </div>
      </Field>

      {/* ── Foco ── */}
      <Field label={kind === 'strength' ? 'Qué has trabajado' : 'Modalidad'}>
        <div className="chips">
          {FOCUS_OPTIONS[kind].map((f) => (
            <button key={f} className="chip" aria-pressed={focus === f} onClick={() => setFocus(f)}>{f}</button>
          ))}
        </div>
        <input
          className="input"
          style={{ marginTop: 8 }}
          value={focus}
          onChange={(e) => setFocus(e.target.value)}
          placeholder={FOCUS_OPTIONS[kind][0]}
          aria-label="Foco del entrenamiento"
        />
      </Field>

      {/* ── Duración e intensidad ── */}
      <div className="figures two">
        <Field label="Duración">
          <NumberInput value={minutes} step={5} min={1} max={480} suffix="min" label="Duración en minutos"
            onChange={setMinutes} />
        </Field>
        <Field label="Dónde">
          <Segmented value={location} onChange={setLocation}
            options={[
              { value: 'home' as const, label: 'Casa' },
              { value: 'gym' as const, label: 'Gym' },
              { value: 'outdoor' as const, label: 'Aire libre' },
            ]} />
        </Field>
      </div>

      <Field label="Intensidad" hint="Es lo que más cambia el coste estimado de la sesión.">
        <div className="rows">
          {(Object.keys(TRAINING_INTENSITY_LABEL) as TrainingIntensity[]).map((i) => (
            <button className="row" key={i} onClick={() => setIntensity(i)}
              style={{ borderLeft: intensity === i ? '3px solid var(--accent)' : '3px solid transparent', paddingLeft: 8 }}>
              <div className="row-body">
                <div className="row-name" style={{ fontSize: '0.88rem' }}>{TRAINING_INTENSITY_LABEL[i]}</div>
                <div className="row-meta">{TRAINING_INTENSITY_HINT[i]}</div>
              </div>
              {intensity === i && <Icon name="check" size={16} />}
            </button>
          ))}
        </div>
      </Field>

      {/* ── Ejercicios ── */}
      <div className="card">
        <div className="card-title">
          <span>{usesSetsAndReps(kind) ? `Ejercicios · ${exercises.length}` : `Bloques · ${exercises.length}`}</span>
          <span style={{ textTransform: 'none', letterSpacing: 0 }}>opcional</span>
        </div>

        {exercises.length === 0 && (
          <p className="note" style={{ marginBottom: 10 }}>
            Apuntarlos no es obligatorio, pero es lo que después permite ver si progresas en cada ejercicio.
          </p>
        )}

        {exercises.map((ex, i) => (
          <div className="row" key={`${ex.exercise}-${i}`}>
            <div className="row-body">
              <div className="row-name" style={{ fontSize: '0.88rem' }}>{ex.exercise}</div>
              <div className="row-meta">
                {usesSetsAndReps(kind) ? `${ex.sets} × ${ex.reps}` : 'bloque'}
                {ex.weightKg ? ` · ${ex.weightKg} kg` : ''}
                {ex.distanceKm ? ` · ${ex.distanceKm} km` : ''}
              </div>
            </div>
            <button className="icon-btn" aria-label={`Quitar ${ex.exercise}`}
              onClick={() => setExercises((prev) => prev.filter((_, j) => j !== i))}><Icon name="trash" size={17} /></button>
          </div>
        ))}

        <div className="field" style={{ marginTop: 10, marginBottom: 6 }}>
          <label>Añadir {usesSetsAndReps(kind) ? 'ejercicio' : 'bloque'}</label>
          <input
            className="input"
            value={exName}
            onChange={(e) => setExName(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addExercise(); }}
            placeholder={usesSetsAndReps(kind) ? 'Press inclinado' : 'Tramo a ritmo alto'}
            aria-label="Nombre del ejercicio"
          />
        </div>

        <div className={usesDistance(kind) ? 'grid-2' : 'grid-3'}>
          {usesSetsAndReps(kind) && (
            <>
              <Field label="Series">
                <NumberInput value={exSets} min={1} max={20} label="Series" onChange={setExSets} />
              </Field>
              <Field label="Reps">
                <input className="input" value={exReps} onChange={(e) => setExReps(e.target.value)}
                  placeholder="8-10" aria-label="Repeticiones" />
              </Field>
            </>
          )}
          <Field label="Peso">
            <div className="input-row">
              <input className="input" inputMode="decimal" value={exWeight}
                onChange={(e) => setExWeight(e.target.value)} placeholder="—" aria-label="Peso en kilos" />
              <span className="suffix">kg</span>
            </div>
          </Field>
          {usesDistance(kind) && (
            <Field label="Distancia">
              <div className="input-row">
                <input className="input" inputMode="decimal" value={exDistance}
                  onChange={(e) => setExDistance(e.target.value)} placeholder="—" aria-label="Distancia en kilómetros" />
                <span className="suffix">km</span>
              </div>
            </Field>
          )}
        </div>

        <button className="btn sm" disabled={exName.trim().length < 2} onClick={addExercise}>
          + Añadir {usesSetsAndReps(kind) ? 'ejercicio' : 'bloque'}
        </button>
      </div>

      {/* ── Rendimiento ── */}
      <Field label="¿Cómo has rendido?" hint="Con las semanas indica si vas sobrado o corto de energía.">
        <div className="chips">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className="chip" aria-pressed={performance === n} onClick={() => setPerformance(n)}>
              {['Muy mal', 'Flojo', 'Normal', 'Bien', 'Muy bien'][n - 1]}
            </button>
          ))}
        </div>
      </Field>

      {/* ── Coste estimado ── */}
      <EstimateNotice>
        <b>{TRAINING_KIND_LABEL[kind]}</b>, {minutes} min, intensidad{' '}
        {TRAINING_INTENSITY_LABEL[intensity].toLowerCase()}: del orden de <b>{g(estimated)} kcal</b> a tu peso.
        Es una estimación conservadora, con un margen de ±20%.
        {demand === 'negligible' ? (
          <> Al ser una sesión corta y suave, hoy no cuenta como día de entrenamiento.</>
        ) : extra > 0 ? (
          <> Tu objetivo ya cuenta con que entrenas, así que solo se suman ~{extra} kcal por lo que esta sesión
            se pasa de tu sesión media.</>
        ) : extra < 0 ? (
          <> Es más suave que tu sesión habitual, así que se descuentan ~{Math.abs(extra)} kcal del objetivo de hoy.</>
        ) : (
          <> Encaja con tu sesión habitual, que ya está incluida en tu objetivo diario.</>
        )}
      </EstimateNotice>
    </Sheet>
  );
}

// ───────────────────────────── Peso ─────────────────────────────

export function WeightSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const ui = useUI();
  const last = app.weights.at(-1);
  const [kg, setKg] = useState<number | ''>(last?.kg ?? app.profile?.startWeightKg ?? '');
  const [date, setDate] = useState(toIsoDate());
  const [time, setTime] = useState(nowTime());
  const [conditions, setConditions] = useState('En ayunas');
  const [bodyFat, setBodyFat] = useState<number | ''>('');
  const [waist, setWaist] = useState<number | ''>('');

  const save = async () => {
    if (kg === '' || kg <= 0) return;
    await app.actions.addWeight(kg, {
      date,
      time,
      conditions: conditions.trim() || undefined,
      bodyFatPct: bodyFat === '' ? undefined : bodyFat,
      waistCm: waist === '' ? undefined : waist,
    });
    // Los objetivos se recalculan sobre la media móvil, no sobre esta pesada.
    await app.actions.recomputeTargets();
    ui.notify('Pesada registrada.');
    onClose();
  };

  return (
    <Sheet title="Registrar peso" onClose={onClose}
      footer={<button className="btn primary" disabled={kg === '' || kg <= 0} onClick={() => void save()}>Guardar</button>}>
      <Field label="Peso">
        <NumberInput value={kg} step={0.1} suffix="kg" onChange={setKg} />
      </Field>
      <div className="figures two">
        <Field label="Fecha">
          <input className="input" type="date" value={date} max={toIsoDate()} onChange={(e) => setDate(e.target.value)} />
        </Field>
        <Field label="Hora">
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </Field>
      </div>
      <Field label="Condiciones" hint="Pesarte siempre igual reduce el ruido. En ayunas, después del baño, es lo más estable.">
        <div className="chips">
          {['En ayunas', 'Después de comer', 'Después de entrenar', 'Por la noche'].map((c) => (
            <button key={c} className="chip" aria-pressed={conditions === c} onClick={() => setConditions(c)}>{c}</button>
          ))}
        </div>
      </Field>
      <div className="figures two">
        <Field label="Grasa corporal (opcional)">
          <NumberInput value={bodyFat} step={0.1} suffix="%" onChange={setBodyFat} />
        </Field>
        <Field label="Cintura (opcional)">
          <NumberInput value={waist} step={0.5} suffix="cm" onChange={setWaist} />
        </Field>
      </div>
      <EstimateNotice>
        Una sola pesada no significa nada: el peso diario se mueve por agua, glucógeno, sodio y contenido
        intestinal. Lo que se usa para decidir es la <b>media móvil de 7 días</b>, y para eso bastan 3-4 pesadas
        por semana.
      </EstimateNotice>

      {app.weights.length > 0 && (
        <div className="card">
          <div className="card-title"><span>Últimas pesadas</span></div>
          <div className="rows">
            {[...app.weights].reverse().slice(0, 8).map((w) => (
              <div className="row" key={w.id}>
                <div className="row-body">
                  <div className="row-name" style={{ fontSize: '0.88rem' }}>{w.kg} kg</div>
                  <div className="row-meta">{w.date} · {w.time}{w.conditions ? ` · ${w.conditions}` : ''}</div>
                </div>
                <button className="icon-btn" aria-label="Borrar pesada"
                  onClick={() => void app.actions.deleteWeight(w.id)}><Icon name="trash" size={17} /></button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
