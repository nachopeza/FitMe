import { useMemo } from 'react';
import { PLAN_BASE_MEAL } from '../../data/plan';
import { nowTime } from '../../domain/dates';
import { isTrainingDay, planForDay, type ResolvedMeal } from '../../domain/plan';
import { MEAL_SLOT_LABEL, type MealSlot, type Nutrients } from '../../domain/types';
import { g } from '../../ui/components';
import { Icon } from '../../ui/icons';
import { useApp } from '../store';
import { useUI } from '../../ui/shell';
import { entryNutrients } from '../logging';

/**
 * El plan de hoy, que es la columna vertebral de la pantalla.
 *
 * Su problema de siempre es que registrar da pereza, y la causa era tener que
 * decidir y buscar cada vez. Con el plan delante no hay nada que decidir: las
 * cantidades están escritas, así que cada comida es un botón.
 *
 * Cada fila dice lo que lleva comido de esa franja frente a lo que el plan pone
 * ahí. Un simple «hecho / pendiente» mentiría: él puede haber comido media
 * comida, y el hueco es justo lo que necesita ver.
 */
export function PlanPanel() {
  const app = useApp();
  const ui = useUI();

  const weekday = useMemo(() => new Date(`${app.date}T12:00:00`).getDay(), [app.date]);
  const meals = useMemo(() => planForDay(weekday, app.foodsById), [weekday, app.foodsById]);

  /** Lo comido en cada franja, para contrastarlo con lo que el plan pone ahí. */
  const eaten = useMemo(() => {
    const map = new Map<MealSlot, Nutrients>();
    for (const e of app.entries) {
      const n = entryNutrients(e);
      const prev = map.get(e.slot);
      map.set(e.slot, prev ? { ...prev, kcal: prev.kcal + n.kcal, protein: prev.protein + n.protein } : n);
    }
    return map;
  }, [app.entries]);

  const now = nowTime();
  const horas = app.profile?.mealTimes ?? {};

  const añadir = async (meal: ResolvedMeal) => {
    const id = await app.actions.logPlanMeal(meal);
    if (id) {
      ui.notify(`${meal.name} · ${g(meal.nutrients.kcal)} kcal`, () => app.actions.deleteEntry(id));
    }
  };

  return (
    <div className="panel rise">
      <div className="panel-head">
        <span className="chip-ico sm c-kcal"><Icon name="plate" size={17} /></span>
        <h3>{isTrainingDay(weekday) ? 'Tu plan · entreno' : 'Tu plan de hoy'}</h3>
        <button className="panel-link" onClick={() => ui.open({ k: 'plan' })}>
          Ver plan <Icon name="chevron" size={15} />
        </button>
      </div>

      <ul className="plan-list">
        {meals.map((meal) => {
          const got = eaten.get(meal.slot);
          const comido = Math.round(got?.kcal ?? 0);
          const previsto = Math.round(meal.nutrients.kcal);
          const hora = horas[meal.slot];
          const pasada = hora ? hora <= now : false;
          const cubierta = previsto > 0 && comido / previsto >= 0.85;
          const estado = cubierta ? 'done' : pasada ? 'behind' : 'ahead';
          return (
            <li className="plan-row" key={meal.id} data-state={estado}>
              <span className="plan-dot" aria-hidden="true" />
              <div className="plan-body">
                <div className="plan-name">
                  {meal.name}
                  {meal.optional && <span className="plan-tag">opcional</span>}
                </div>
                <div className="plan-what">{resumen(meal)}</div>
              </div>
              <div className="plan-kcal">
                {comido > 0 ? (
                  <>
                    <b>{g(comido)}</b>
                    <span>de {g(previsto)} kcal</span>
                  </>
                ) : (
                  <>
                    <b>{g(previsto)}</b>
                    <span>kcal</span>
                  </>
                )}
              </div>
              <button
                className="plan-add"
                onClick={() => void añadir(meal)}
                aria-label={`Registrar ${meal.name} con las cantidades del plan`}
              >
                <Icon name={cubierta ? 'check' : 'plus'} size={17} />
              </button>
            </li>
          );
        })}
      </ul>

      <p className="note tight plan-foot">
        Tu comida base: {PLAN_BASE_MEAL}. Arroz y pasta en seco, carne y pescado en crudo.
      </p>
    </div>
  );
}

/** Las cantidades en una línea, como las leería en la hoja. */
function resumen(meal: ResolvedMeal): string {
  return meal.parts
    .map((p) => `${g(p.grams)} g ${corto(p.food.name)}`)
    .join(' · ');
}

/** El nombre sin los paréntesis de estado: en una línea de cantidades sobran. */
function corto(name: string): string {
  return name.replace(/\s*\([^)]*\)\s*$/, '').toLowerCase();
}

export { MEAL_SLOT_LABEL };
