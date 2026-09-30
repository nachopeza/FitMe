import { useState } from 'react';
import { nowTime, toIsoDate } from '../../domain/dates';
import { classifyDay, trainingKcal } from '../../domain/nutrition';
import { DAY_TYPE_LABEL, type Digestion, type Hunger, type TrainingSession, type TrainingSet } from '../../domain/types';
import { EstimateNotice, Field, NumberInput, Sheet, Segmented, g } from '../../ui/components';
import { useUI } from '../../ui/shell';
import { useApp } from '../store';

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
    trained: !!day?.training,
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
  high: '😋 Mucha', normal: '🙂 Normal', low: '😐 Poca', veryLow: '🤢 Muy poco apetito',
};
const DIGESTION: Record<Digestion, string> = {
  good: '🟢 Bien', bloated: '🟡 Hinchado', bad: '🔴 Muy incómodo',
};

// ───────────────────────────── Entrenamiento ─────────────────────────────

export function TrainingSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const existing = app.day?.training;
  const [focus, setFocus] = useState(existing?.focus ?? '');
  const [minutes, setMinutes] = useState<number | ''>(existing?.minutes ?? 55);
  const [location, setLocation] = useState<'home' | 'gym'>(
    existing?.location ?? (app.profile?.trainingLocation === 'gym' ? 'gym' : 'home'),
  );
  const [performance, setPerformance] = useState<number>(existing?.performance ?? 3);
  const [exercises, setExercises] = useState<TrainingSet[]>(existing?.exercises ?? []);
  const [draft, setDraft] = useState<TrainingSet>({ exercise: '', sets: 4, reps: '10' });

  const weight = app.weights.at(-1)?.kg ?? app.profile?.startWeightKg ?? 66.5;
  const estimated = Math.round(trainingKcal(weight, minutes === '' ? 0 : minutes));

  const save = async () => {
    const session: TrainingSession = {
      focus: focus.trim() || 'Entrenamiento',
      minutes: minutes === '' ? 0 : minutes,
      exercises,
      performance,
      location,
    };
    await app.actions.patchDay({ training: session });
    onClose();
  };

  return (
    <Sheet
      title="🏋️ Entrenamiento de hoy"
      onClose={onClose}
      footer={
        <div className="btn-row">
          {existing ? (
            <button className="btn danger" onClick={async () => { await app.actions.patchDay({ training: undefined }); onClose(); }}>
              Quitar
            </button>
          ) : (
            <button className="btn ghost" onClick={onClose}>Cancelar</button>
          )}
          <button className="btn primary" onClick={() => void save()}>Guardar</button>
        </div>
      }
    >
      <Field label="Qué has entrenado">
        <input className="input" value={focus} onChange={(e) => setFocus(e.target.value)}
          placeholder="Pecho, Espalda, Pierna, Empuje…" />
        <div className="chips" style={{ marginTop: 8 }}>
          {['Pecho', 'Espalda', 'Hombro', 'Brazo', 'Pierna', 'Empuje', 'Tirón', 'Cuerpo completo'].map((f) => (
            <button key={f} className="chip" aria-pressed={focus === f} onClick={() => setFocus(f)}>{f}</button>
          ))}
        </div>
      </Field>

      <div className="grid-2">
        <Field label="Duración">
          <NumberInput value={minutes} step={5} suffix="min" onChange={setMinutes} />
        </Field>
        <Field label="Dónde">
          <Segmented value={location} onChange={setLocation}
            options={[{ value: 'home', label: 'Casa' }, { value: 'gym', label: 'Gimnasio' }]} />
        </Field>
      </div>

      <Field label="¿Cómo has rendido?" hint="Sirve para saber si la energía va sobrada o corta a lo largo de las semanas.">
        <div className="chips">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} className="chip" aria-pressed={performance === n} onClick={() => setPerformance(n)}>
              {['Muy mal', 'Flojo', 'Normal', 'Bien', 'Muy bien'][n - 1]}
            </button>
          ))}
        </div>
      </Field>

      {/* Ejercicios: opcionales, pero útiles para ver progresión */}
      <div className="card tight">
        <div className="card-title"><span>Ejercicios · {exercises.length}</span></div>
        {exercises.map((ex, i) => (
          <div className="row" key={i}>
            <div className="row-main">
              <div className="row-title" style={{ fontSize: '0.88rem' }}>{ex.exercise}</div>
              <div className="row-sub">{ex.sets} × {ex.reps}{ex.weightKg ? ` · ${ex.weightKg} kg` : ''}</div>
            </div>
            <button className="icon-btn" aria-label={`Quitar ${ex.exercise}`}
              onClick={() => setExercises((prev) => prev.filter((_, j) => j !== i))}>🗑️</button>
          </div>
        ))}
        <div className="input-row" style={{ marginTop: 10 }}>
          <input className="input" value={draft.exercise} placeholder="Press inclinado"
            onChange={(e) => setDraft({ ...draft, exercise: e.target.value })} />
        </div>
        <div className="grid-3" style={{ marginTop: 8 }}>
          <input className="input" type="number" inputMode="numeric" value={draft.sets} aria-label="Series"
            onChange={(e) => setDraft({ ...draft, sets: Number(e.target.value) })} />
          <input className="input" value={draft.reps} aria-label="Repeticiones"
            onChange={(e) => setDraft({ ...draft, reps: e.target.value })} />
          <input className="input" type="number" inputMode="decimal" value={draft.weightKg ?? ''} placeholder="kg"
            aria-label="Peso en kilos"
            onChange={(e) => setDraft({ ...draft, weightKg: e.target.value === '' ? undefined : Number(e.target.value) })} />
        </div>
        <div className="hint">Series × repeticiones × peso. El peso es opcional.</div>
        <button className="btn sm" style={{ marginTop: 8 }} disabled={draft.exercise.trim().length < 2}
          onClick={() => { setExercises((prev) => [...prev, draft]); setDraft({ exercise: '', sets: draft.sets, reps: draft.reps }); }}>
          Añadir ejercicio
        </button>
      </div>

      <EstimateNotice>
        Una sesión de fuerza de {minutes === '' ? 0 : minutes} minutos a tu peso gasta del orden de
        <b> {estimated} kcal</b>. Es una estimación conservadora y deliberadamente baja: sobreestimar el gasto
        del entrenamiento es el error más común. No se suma a tu objetivo del día; el objetivo ya cuenta con que
        entrenas.
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
    <Sheet title="⚖️ Registrar peso" onClose={onClose}
      footer={<button className="btn primary" disabled={kg === '' || kg <= 0} onClick={() => void save()}>Guardar</button>}>
      <Field label="Peso">
        <NumberInput value={kg} step={0.1} suffix="kg" onChange={setKg} />
      </Field>
      <div className="grid-2">
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
      <div className="grid-2">
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
        <div className="card tight">
          <div className="card-title"><span>Últimas pesadas</span></div>
          <div className="list">
            {[...app.weights].reverse().slice(0, 8).map((w) => (
              <div className="row" key={w.id}>
                <div className="row-main">
                  <div className="row-title" style={{ fontSize: '0.88rem' }}>{w.kg} kg</div>
                  <div className="row-sub">{w.date} · {w.time}{w.conditions ? ` · ${w.conditions}` : ''}</div>
                </div>
                <button className="icon-btn" aria-label="Borrar pesada"
                  onClick={() => void app.actions.deleteWeight(w.id)}>🗑️</button>
              </div>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}
