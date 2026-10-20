import { bmr, estimateMaintenance, profileAge, stepsKcal, trainingKcal } from '../../domain/nutrition';
import { GOAL_LABEL, type Profile } from '../../domain/types';
import { Section, g } from '../../ui/components';
import { useApp } from '../store';

/**
 * De dónde salen tus calorías.
 *
 * No es decoración: es la respuesta a «¿por qué estas calorías y no otras?».
 * Se muestra como una suma, paso a paso, con los datos que la alimentan, para
 * que se pueda discutir cada tramo en lugar de aceptar un número a ciegas.
 */
export function MacroAnalysis({ profile }: { profile: Profile }) {
  const app = useApp();

  // El peso que manda es la media de las pesadas recientes, no la última.
  const recent = app.weights.slice(-10).map((w) => w.kg);
  const weightKg = recent.length >= 2
    ? Math.round((recent.reduce((a, b) => a + b, 0) / recent.length) * 10) / 10
    : profile.startWeightKg;

  const age = profileAge(profile);
  const basal = Math.round(bmr(profile.sex, weightKg, profile.heightCm, age));
  const est = estimateMaintenance({
    sex: profile.sex,
    weightKg,
    heightCm: profile.heightCm,
    age,
    activityLevel: profile.activityLevel,
    typicalSteps: profile.typicalSteps,
    trainingDaysPerWeek: profile.trainingDaysPerWeek,
  });

  const fromActivity = Math.round(est.maintenance - basal - est.fromTraining - est.fromSteps);
  const targets = app.baseTargets;
  const surplus = targets.kcal.target - est.maintenance;

  const proteinPerKg = Math.round((targets.protein.target / weightKg) * 100) / 100;
  const fatPct = Math.round(((targets.fat.target * 9) / targets.kcal.target) * 100);
  const carbsPerKg = Math.round((targets.carbs.target / weightKg) * 10) / 10;
  const fiberPer1000 = Math.round((targets.fiber.target / (targets.kcal.target / 1000)) * 10) / 10;
  const kcalPerKg = Math.round((targets.kcal.target / weightKg) * 10) / 10;

  const sessionKcal = Math.round(trainingKcal(weightKg, 55));
  const extraSteps = Math.max(0, profile.typicalSteps - 5000);

  return (
    <>
      <Section title="De dónde salen tus calorías" aside={`${g(targets.kcal.target)} kcal`}>
        <div className="rows">
          <Step
            name="Metabolismo basal"
            detail={`${weightKg} kg, ${profile.heightCm} cm, ${age} años`}
            value={basal}
          />
          <Step
            name="Vida diaria, sin entrenar"
            detail="Moverte, trabajar, digerir"
            value={fromActivity}
            add
          />
          <Step
            name="Entrenamiento"
            detail={`${profile.trainingDaysPerWeek} sesiones por semana, repartidas`}
            value={est.fromTraining}
            add
          />
          <Step
            name="Pasos"
            detail={extraSteps > 0 ? `${g(extraSteps)} por encima de la base` : 'En la base, no suman'}
            value={est.fromSteps}
            add
          />
          <Step name="Mantenimiento" detail="Lo que gastas en un día medio" value={est.maintenance} total />
          <Step
            name={GOAL_LABEL[profile.goal]}
            detail={surplus >= 0 ? 'Superávit para construir músculo' : 'Déficit suave'}
            value={surplus}
            add
          />
          {profile.manualKcalOffset !== 0 && (
            <Step
              name="Ajuste por tu evolución"
              detail="A partir de tu peso real de las últimas semanas"
              value={profile.manualKcalOffset}
              add
            />
          )}
          <Step name="Tu objetivo" detail={`${kcalPerKg} kcal por kilo de peso`} value={targets.kcal.target} total />
        </div>

        <p className="note tight" style={{ marginTop: 14 }}>
          Toda estimación de gasto tiene un margen de un 10 a un 15%. Por eso el número no es sagrado: lo que
          manda es si tu peso se mueve como debe, y eso se corrige en Progreso.
        </p>
      </Section>

      <Section title="Cómo se reparten" aside="y por qué">
        <div className="rows">
          <Split
            name="Proteína"
            value={`${g(targets.protein.target)} g`}
            why={`${proteinPerKg} g por kilo. Es lo primero que se reserva: condiciona cuánto de lo que ganes será músculo.`}
          />
          <Split
            name="Grasas"
            value={`${g(targets.fat.target)} g`}
            why={`El ${fatPct}% de la energía, con un suelo de 0,8 g por kilo por salud hormonal.`}
          />
          <Split
            name="Carbohidratos"
            value={`${g(targets.carbs.target)} g`}
            why={`${carbsPerKg} g por kilo: toda la energía que queda. Son el combustible del entrenamiento, así que van los últimos a propósito.`}
          />
          <Split
            name="Fibra"
            value={`${g(targets.fiber.target)} g`}
            why={`${fiberPer1000} g por cada 1.000 kcal, con tope según cómo te siente.`}
          />
        </div>
      </Section>

      <Section title="Cálculos sueltos que te pueden servir">
        <div className="figures">
          <div className="figure">
            <div className="figure-label">Una sesión tuya</div>
            <div className="figure-value">{g(sessionKcal)}</div>
            <div className="figure-sub">kcal, 55 min de fuerza</div>
          </div>
          <div className="figure">
            <div className="figure-label">Mil pasos</div>
            <div className="figure-value">{g(stepsKcal(weightKg, 1000, 0))}</div>
            <div className="figure-sub">kcal aproximadas</div>
          </div>
          <div className="figure">
            <div className="figure-label">Peso usado</div>
            <div className="figure-value">{weightKg}</div>
            <div className="figure-sub">
              {recent.length >= 2 ? `media de ${recent.length} pesadas` : 'el que indicaste'}
            </div>
          </div>
        </div>
      </Section>
    </>
  );
}

function Step({
  name, detail, value, add = false, total = false,
}: { name: string; detail: string; value: number; add?: boolean; total?: boolean }) {
  return (
    <div className="row" style={total ? { borderTop: '1px solid var(--rule-strong)' } : undefined}>
      <div className="row-body">
        <div className="row-name" style={total ? { fontWeight: 700 } : undefined}>{name}</div>
        <div className="row-meta">{detail}</div>
      </div>
      <div className="row-num" style={total ? { color: 'var(--accent)' } : undefined}>
        {add && value >= 0 ? '+' : ''}{g(value)}
        <small>kcal</small>
      </div>
    </div>
  );
}

function Split({ name, value, why }: { name: string; value: string; why: string }) {
  return (
    <div className="row" style={{ alignItems: 'flex-start' }}>
      <div className="row-body">
        <div className="row-name">{name}</div>
        <div className="row-meta" style={{ whiteSpace: 'normal', lineHeight: 1.45 }}>{why}</div>
      </div>
      <div className="row-num">{value}</div>
    </div>
  );
}
