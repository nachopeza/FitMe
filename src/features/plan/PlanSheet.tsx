import { useMemo } from 'react';
import { PLAN_BASE_MEAL, PLAN_DINNERS, PLAN_NOTES, PLAN_TARGETS } from '../../data/plan';
import {
  isTrainingDay, planDayTotal, planForDay, planGap, planLevers, resolveDinner,
} from '../../domain/plan';
import { Sheet, g } from '../../ui/components';
import { Icon } from '../../ui/icons';
import { useApp } from '../store';

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];

/**
 * El plan entero, para cuando quiere mirarlo y no solo seguirlo.
 *
 * Lo importante de esta hoja no es repetir la suya: es la cuenta que ella no
 * trae. Las cantidades escritas suman menos que el objetivo de la propia hoja,
 * y esa diferencia es exactamente su problema de fondo —come de menos—, así que
 * se dice con un número y se acompaña de los márgenes que el plan ya autoriza.
 */
export function PlanSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const hoy = useMemo(() => new Date(`${app.date}T12:00:00`).getDay(), [app.date]);
  const meals = useMemo(() => planForDay(hoy, app.foodsById), [hoy, app.foodsById]);
  const gap = useMemo(() => planGap(hoy, app.foodsById), [hoy, app.foodsById]);
  const levers = useMemo(() => planLevers(hoy, app.foodsById), [hoy, app.foodsById]);

  return (
    <Sheet
      title="Tu plan nutricional"
      subtitle={`${PLAN_TARGETS.kcal.min}–${PLAN_TARGETS.kcal.max} kcal · ${PLAN_TARGETS.protein.min}–${PLAN_TARGETS.protein.max} g de proteína`}
      onClose={onClose}
    >
      <div className="panel tint-mint" style={{ display: 'block' }}>
        <div className="plan-kv"><span>Objetivo</span><b>{PLAN_TARGETS.goal}</b></div>
        <div className="plan-kv"><span>Peso de la hoja</span><b>{PLAN_TARGETS.weightKg} kg</b></div>
        <div className="plan-kv"><span>Entrenas</span><b>Lunes, miércoles y viernes</b></div>
        <div className="plan-kv"><span>Comida base</span><b>{PLAN_BASE_MEAL}</b></div>
      </div>

      {/* ── La cuenta que la hoja no trae ── */}
      {gap.short > 0 && (
        <section className="section">
          <h3 className="section-title">Ojo con esto</h3>
          <p className="note">
            Las cantidades de tu hoja, al pie de la letra, suman <b>{g(gap.planned)} kcal</b> hoy, y tu
            objetivo empieza en <b>{g(gap.targetMin)}</b>. Faltan <b>{g(gap.short)} kcal</b>.
          </p>
          <p className="note">
            No es que la hoja esté mal: cada comida trae un rango y las cantidades escritas son el
            extremo bajo. La proteína sí llega ({g(gap.protein)} g, y pide {gap.proteinMin}). Lo que se
            queda corto es la energía, que es justo lo que necesitas para ganar músculo.
          </p>
          <p className="note tight" style={{ marginTop: 10, fontWeight: 650 }}>
            Márgenes que tu propio plan permite:
          </p>
          <ul className="plan-levers">
            {levers.map((l) => (
              <li key={l.label}>
                <b>+{l.kcal} kcal</b>
                <span>{l.label}</span>
                <small>{l.from}</small>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* ── Hoy, comida a comida ── */}
      <section className="section">
        <h3 className="section-title">
          {DIAS[hoy]}{isTrainingDay(hoy) ? ' · entrenas' : ' · descanso'}
        </h3>
        {meals.map((m) => (
          <div className="plan-meal" key={m.id}>
            <div className="plan-meal-head">
              <b>{m.name}</b>
              <span>{g(m.nutrients.kcal)} kcal · {g(m.nutrients.protein)} g prot</span>
            </div>
            <ul className="plan-parts">
              {m.parts.map((p) => (
                <li key={p.food.id}>
                  <span>{p.food.name}</span>
                  <b>{g(p.grams)}{p.maxGrams ? `–${g(p.maxGrams)}` : ''} g</b>
                </li>
              ))}
            </ul>
            <p className="note tight">{m.note}</p>
          </div>
        ))}
        <p className="note tight" style={{ marginTop: 10 }}>
          Total del día según el plan: <b>{g(planDayTotal(hoy, app.foodsById).kcal)} kcal</b>.
        </p>
      </section>

      {/* ── Las cenas para rotar ── */}
      <section className="section">
        <h3 className="section-title">Cenas para rotar</h3>
        {[1, 2, 3, 4, 5, 6, 0].map((d) => {
          const dinner = PLAN_DINNERS.find((x) => x.weekday === d);
          if (!dinner) return null;
          const r = resolveDinner(dinner, app.foodsById);
          return (
            <div className="plan-dinner" key={d} data-today={d === hoy ? '' : undefined}>
              <div className="plan-dinner-head">
                <span className="plan-day">{DIAS[d]}</span>
                <b>{dinner.name}</b>
                <span className="plan-dinner-kcal">{g(r.nutrients.kcal)} kcal</span>
              </div>
              <p className="note tight">
                {r.parts.map((p) => `${g(p.grams)} g ${p.food.name.replace(/\s*\([^)]*\)\s*$/, '').toLowerCase()}`).join(' · ')}
              </p>
              {dinner.note && <p className="note tight plan-warn">{dinner.note}</p>}
            </div>
          );
        })}
      </section>

      {/* ── Las notas al pie, que son plan y no adorno ── */}
      <section className="section">
        <h3 className="section-title">Lo que dice tu hoja</h3>
        <div className="plan-note"><Icon name="star" size={16} /><p>{PLAN_NOTES.antojos}</p></div>
        <div className="plan-note"><Icon name="dumbbell" size={16} /><p>{PLAN_NOTES.descanso}</p></div>
        <div className="plan-note"><Icon name="weight" size={16} /><p>{PLAN_NOTES.seguimiento}</p></div>
        <div className="plan-note"><Icon name="bulb" size={16} /><p>{PLAN_NOTES.pesos}</p></div>
      </section>
    </Sheet>
  );
}
