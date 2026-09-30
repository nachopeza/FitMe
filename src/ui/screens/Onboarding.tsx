import { useMemo, useState } from 'react';
import { makeDefaultProfile } from '../../data/db';
import { computeTargets, estimateMaintenance, profileAge } from '../../domain/nutrition';
import { searchFoods } from '../../domain/parser';
import {
  GOAL_LABEL, MACRO_KEYS, MEAL_SLOTS, MEAL_SLOT_LABEL,
  type ActivityLevel, type Goal, type Hunger, type Profile, type Sex,
} from '../../domain/types';
import { useApp } from '../../features/store';
import { Card, EstimateNotice, Field, MACRO_META, NumberInput, Segmented, WhyButton, g } from '../components';

/**
 * Onboarding. Recoge los 16 datos que pide el usuario, agrupados en pasos
 * cortos: un formulario de 16 campos en móvil no se rellena.
 *
 * Al final muestra la estimación inicial dejando claro que es un punto de
 * partida, no una verdad.
 */

const ACTIVITY: { value: ActivityLevel; label: string; sub: string }[] = [
  { value: 'sedentary', label: 'Sedentaria', sub: 'Trabajo sentado, poco movimiento' },
  { value: 'light', label: 'Ligera', sub: 'Algo de movimiento a lo largo del día' },
  { value: 'moderate', label: 'Moderada', sub: 'Bastante de pie o caminando' },
  { value: 'active', label: 'Activa', sub: 'Trabajo físico o muchos pasos' },
  { value: 'veryActive', label: 'Muy activa', sub: 'Trabajo físico exigente' },
];

const APPETITE: { value: Hunger; label: string }[] = [
  { value: 'high', label: 'Suelo tener mucha hambre' },
  { value: 'normal', label: 'Normal' },
  { value: 'low', label: 'Me cuesta comer mucha cantidad' },
  { value: 'veryLow', label: 'Me cuesta bastante comer' },
];

const STEPS = ['Tú', 'Actividad', 'Entrenamiento', 'Objetivo', 'Horarios', 'Tu comida', 'Estimación'] as const;

export function Onboarding() {
  const app = useApp();
  const [step, setStep] = useState(0);
  const [p, setP] = useState<Profile>(() => makeDefaultProfile());
  const [foodQuery, setFoodQuery] = useState('');
  const [saving, setSaving] = useState(false);

  const set = <K extends keyof Profile>(k: K, v: Profile[K]) => setP((prev) => ({ ...prev, [k]: v }));

  const estimate = useMemo(
    () =>
      computeTargets({
        sex: p.sex, weightKg: p.startWeightKg, heightCm: p.heightCm, age: profileAge(p),
        activityLevel: p.activityLevel, typicalSteps: p.typicalSteps,
        trainingDaysPerWeek: p.trainingDaysPerWeek, goal: p.goal,
        digestiveTolerance: 'normal',
      }),
    [p],
  );
  const maintenance = useMemo(
    () => estimateMaintenance({
      sex: p.sex, weightKg: p.startWeightKg, heightCm: p.heightCm, age: profileAge(p),
      activityLevel: p.activityLevel, typicalSteps: p.typicalSteps, trainingDaysPerWeek: p.trainingDaysPerWeek,
    }),
    [p],
  );

  const suggestions = useMemo(
    () => (foodQuery.trim() ? searchFoods(foodQuery, app.foods, 12) : []),
    [foodQuery, app.foods],
  );

  const commonFoods = useMemo(
    () => app.foods.filter((f) => COMMON_IDS.includes(f.id)),
    [app.foods],
  );

  const togglePantry = (id: string) =>
    set('pantryFoodIds', p.pantryFoodIds.includes(id)
      ? p.pantryFoodIds.filter((x) => x !== id)
      : [...p.pantryFoodIds, id]);

  const finish = async () => {
    setSaving(true);
    try {
      await app.actions.saveProfile({ ...p, targets: estimate, onboardedAt: Date.now() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="screen" style={{ paddingBottom: 40 }}>
      <header className="screen-header">
        <div>
          <h1>FitMe</h1>
          <div className="screen-sub">Paso {step + 1} de {STEPS.length} · {STEPS[step]}</div>
        </div>
      </header>

      <div className="bar" style={{ marginBottom: 16 }}>
        <span className="bar-fill" style={{ width: `${((step + 1) / STEPS.length) * 100}%`, background: 'var(--accent)' }} />
      </div>

      {step === 0 && (
        <Card title="Tus datos básicos">
          <Field label="Peso actual" hint="Aproximado está bien. Lo iremos afinando con tus pesadas.">
            <NumberInput value={p.startWeightKg} step={0.1} suffix="kg" onChange={(v) => v !== '' && set('startWeightKg', v)} />
          </Field>
          <Field label="Altura">
            <NumberInput value={p.heightCm} suffix="cm" onChange={(v) => v !== '' && set('heightCm', v)} />
          </Field>
          <Field label="Edad">
            <NumberInput value={profileAge(p)} suffix="años"
              onChange={(v) => v !== '' && set('birthYear', new Date().getFullYear() - v)} />
          </Field>
          <Field label="Sexo" hint="Solo interviene en la estimación del metabolismo basal.">
            <Segmented<Sex> value={p.sex} onChange={(v) => set('sex', v)}
              options={[{ value: 'male', label: 'Hombre' }, { value: 'female', label: 'Mujer' }]} />
          </Field>
        </Card>
      )}

      {step === 1 && (
        <Card title="Tu actividad diaria">
          <Field label="Sin contar el entrenamiento, tu día es…">
            <div className="list">
              {ACTIVITY.map((a) => (
                <button className="row" key={a.value} onClick={() => set('activityLevel', a.value)}
                  style={{ borderLeft: p.activityLevel === a.value ? '3px solid var(--accent)' : '3px solid transparent', paddingLeft: 8 }}>
                  <div className="row-main">
                    <div className="row-title">{a.label}</div>
                    <div className="row-sub">{a.sub}</div>
                  </div>
                  {p.activityLevel === a.value && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Pasos aproximados al día" hint="Si no lo sabes, 8.000 es una cifra típica. Se puede cambiar después.">
            <NumberInput value={p.typicalSteps} step={500} suffix="pasos" onChange={(v) => v !== '' && set('typicalSteps', v)} />
          </Field>
        </Card>
      )}

      {step === 2 && (
        <Card title="Tu entrenamiento">
          <Field label="Días de entrenamiento por semana">
            <NumberInput value={p.trainingDaysPerWeek} min={0} max={7} suffix="días"
              onChange={(v) => v !== '' && set('trainingDaysPerWeek', v)} />
          </Field>
          <Field label="Tipo de entrenamiento">
            <input className="input" value={p.trainingStyle} onChange={(e) => set('trainingStyle', e.target.value)}
              placeholder="Fuerza / hipertrofia" />
          </Field>
          <Field label="Dónde entrenas">
            <Segmented value={p.trainingLocation} onChange={(v) => set('trainingLocation', v)}
              options={[{ value: 'home' as const, label: 'Casa' }, { value: 'gym' as const, label: 'Gimnasio' }, { value: 'both' as const, label: 'Ambos' }]} />
          </Field>
          <Field label="Hora habitual de entrenamiento"
            hint="Si entrenas tarde, la app prioriza cenas rápidas y poco voluminosas en lugar de platos grandes.">
            <input className="input" type="time" value={p.trainingTime} onChange={(e) => set('trainingTime', e.target.value)} />
          </Field>
        </Card>
      )}

      {step === 3 && (
        <Card title="Tu objetivo">
          <Field label="Qué buscas ahora mismo">
            <div className="list">
              {(Object.keys(GOAL_LABEL) as Goal[]).map((goal) => (
                <button className="row" key={goal} onClick={() => set('goal', goal)}
                  style={{ borderLeft: p.goal === goal ? '3px solid var(--accent)' : '3px solid transparent', paddingLeft: 8 }}>
                  <div className="row-main">
                    <div className="row-title">{GOAL_LABEL[goal]}</div>
                    <div className="row-sub">{GOAL_HINT[goal]}</div>
                  </div>
                  {p.goal === goal && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Tu apetito habitual"
            hint="Determina si las propuestas van hacia comidas grandes o hacia comidas pequeñas y densas.">
            <div className="list">
              {APPETITE.map((a) => (
                <button className="row" key={a.value} onClick={() => set('appetite', a.value)}
                  style={{ borderLeft: p.appetite === a.value ? '3px solid var(--accent)' : '3px solid transparent', paddingLeft: 8 }}>
                  <div className="row-main"><div className="row-title" style={{ fontSize: '0.88rem' }}>{a.label}</div></div>
                  {p.appetite === a.value && <span aria-hidden="true">✓</span>}
                </button>
              ))}
            </div>
          </Field>
        </Card>
      )}

      {step === 4 && (
        <Card title="Tus horarios de comida">
          <p className="note" style={{ marginBottom: 12 }}>
            No hay horarios correctos. Si desayunas a las 11:00, la app se adapta a eso y no te va a forzar un
            desayuno enorme.
          </p>
          {MEAL_SLOTS.filter((s) => s !== 'extra').map((slot) => (
            <Field key={slot} label={MEAL_SLOT_LABEL[slot]}>
              <input className="input" type="time" value={p.mealTimes[slot] ?? ''}
                onChange={(e) => set('mealTimes', { ...p.mealTimes, [slot]: e.target.value })} />
            </Field>
          ))}
        </Card>
      )}

      {step === 5 && (
        <>
          <Card title="Lo que comes habitualmente">
            <p className="note" style={{ marginBottom: 10 }}>
              Marca lo que tienes en casa o comes a menudo. Las propuestas de comida saldrán de aquí, así que
              cuanto más fiel sea, más útiles serán.
            </p>
            <div className="chips" style={{ marginBottom: 12 }}>
              {commonFoods.map((f) => (
                <button key={f.id} className="chip" aria-pressed={p.pantryFoodIds.includes(f.id)}
                  onClick={() => togglePantry(f.id)}>
                  {f.name.replace(/\([^)]*\)/g, '').trim()}
                </button>
              ))}
            </div>
            <Field label="Buscar más alimentos">
              <input className="input" value={foodQuery} onChange={(e) => setFoodQuery(e.target.value)}
                placeholder="Por ejemplo: langostinos, mozzarella…" />
            </Field>
            {suggestions.length > 0 && (
              <div className="chips">
                {suggestions.map((f) => (
                  <button key={f.id} className="chip" aria-pressed={p.pantryFoodIds.includes(f.id)}
                    onClick={() => togglePantry(f.id)}>
                    {f.name}
                  </button>
                ))}
              </div>
            )}
            <div className="note" style={{ marginTop: 10 }}>
              {p.pantryFoodIds.length} alimentos marcados.
            </div>
          </Card>
          <Card title="Restricciones y presupuesto">
            <Field label="Restricciones alimentarias" hint="Separadas por comas. Déjalo vacío si no tienes ninguna.">
              <input className="input" value={p.restrictions.join(', ')} placeholder="sin lactosa, sin cerdo…"
                onChange={(e) => set('restrictions', e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} />
            </Field>
            <Field label="Presupuesto aproximado">
              <Segmented value={p.budget} onChange={(v) => set('budget', v)}
                options={[{ value: 'low' as const, label: 'Ajustado' }, { value: 'medium' as const, label: 'Normal' }, { value: 'high' as const, label: 'Holgado' }]} />
            </Field>
          </Card>
        </>
      )}

      {step === 6 && (
        <>
          <Card title="Estimación inicial">
            <div className="list">
              {MACRO_KEYS.map((k) => (
                <div className="row" key={k}>
                  <div className="row-main">
                    <div className="row-title">{MACRO_META[k].icon} {MACRO_META[k].label}</div>
                    <div className="row-sub">Rango {g(estimate[k].min)}–{g(estimate[k].max)} {MACRO_META[k].unit}</div>
                  </div>
                  <div className="row-side" style={{ fontSize: '1rem', fontWeight: 700 }}>
                    {g(estimate[k].target)} <span style={{ fontSize: '0.72rem', color: 'var(--text-faint)' }}>{MACRO_META[k].unit}</span>
                  </div>
                </div>
              ))}
            </div>
            <div style={{ marginTop: 12 }}>
              <EstimateNotice>
                <b>Estos son valores iniciales.</b> Salen de una estimación del gasto, que tiene un margen de
                ±10-15%. Los iremos ajustando con tus datos reales: peso, entrenamiento y adherencia. Nunca de
                golpe.
              </EstimateNotice>
            </div>
          </Card>
          <Card title="De dónde sale">
            <div className="grid-2">
              <div className="stat">
                <div className="stat-label">Mantenimiento</div>
                <div className="stat-value">{g(maintenance.maintenance)}</div>
                <div className="stat-sub">kcal/día estimadas</div>
              </div>
              <div className="stat">
                <div className="stat-label">Objetivo</div>
                <div className="stat-value">{g(estimate.kcal.target)}</div>
                <div className="stat-sub">
                  {estimate.kcal.target > maintenance.maintenance ? '+' : ''}
                  {g(estimate.kcal.target - maintenance.maintenance)} kcal
                </div>
              </div>
            </div>
            <div style={{ marginTop: 10 }}>
              <WhyButton reasons={estimate.rationale} label="Ver el cálculo completo" />
            </div>
          </Card>
        </>
      )}

      <div className="btn-row" style={{ marginTop: 6 }}>
        <button className="btn ghost" disabled={step === 0} onClick={() => setStep((s) => Math.max(0, s - 1))}>
          Atrás
        </button>
        {step < STEPS.length - 1 ? (
          <button className="btn primary" onClick={() => setStep((s) => s + 1)}>Continuar</button>
        ) : (
          <button className="btn primary" disabled={saving} onClick={() => void finish()}>
            {saving ? <span className="spinner" /> : 'Empezar'}
          </button>
        )}
      </div>
    </div>
  );
}

const GOAL_HINT: Record<Goal, string> = {
  leanGain: 'Superávit pequeño y sostenido. Ganar músculo sin grasa innecesaria.',
  maintain: 'Mantener el peso y mejorar en el entrenamiento.',
  recomp: 'Ganar músculo y perder algo de grasa a la vez. Progreso más lento.',
  slowCut: 'Déficit suave, protegiendo la masa muscular.',
};

/** Alimentos que se ofrecen marcados de entrada por ser de consumo habitual. */
const COMMON_IDS = [
  'pollo-pechuga-cocinada', 'carne-picada-pollo-cocinada', 'carne-picada-mixta-cocinada',
  'entrecot-cocinado', 'atun-natural', 'anchoas', 'langostinos-cocidos', 'huevo', 'jamon-serrano',
  'yogur-natural', 'yogur-proteico', 'queso-curado', 'mozzarella', 'queso-feta', 'bebida-soja',
  'arroz-cocido', 'pasta-cocida', 'patata-cocida', 'pan-blanco', 'tortilla-trigo', 'cereales-maiz',
  'avena', 'platano', 'manzana', 'lentejas-cocidas', 'garbanzos-cocidos', 'tomate', 'lechuga',
  'pimiento-verde', 'piquillo', 'champinones', 'aceite-oliva', 'tomate-frito', 'cafe',
  'cacao-desgrasado', 'te', 'maca',
];
