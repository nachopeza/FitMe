import { useMemo, useState } from 'react';
import { PLAN_DINNERS, PLAN_MEALS } from '../../data/plan';
import { scaleNutrients, sumNutrients } from '../../domain/nutrition';
import { dinnerFor, resolveDinner, resolveMeal } from '../../domain/plan';
import type { Food, Nutrients } from '../../domain/types';
import { Sheet, g } from '../../ui/components';
import { Icon } from '../../ui/icons';
import { useUI } from '../../ui/shell';
import { useApp } from '../store';
import { FoodPicker } from './FoodPicker';

/**
 * Una comida del plan, con sus cantidades a mano.
 *
 * Esto es lo que faltaba: la hoja decía 120 g de arroz y no había forma de
 * decir «yo me como 100». El plan es el punto de partida, no una condena, así
 * que aquí se cambia cada gramo, se quita lo que no toca y se añade lo que sí,
 * y se puede dejar guardado como la cantidad de siempre.
 *
 * Dos acciones distintas a propósito:
 *   - Registrar: lo de hoy, con lo que haya en pantalla.
 *   - Guardar como mi cantidad: cambia la base para los días siguientes.
 * Mezclarlas haría que anotar un día raro le reescribiera el plan entero.
 */
export function PlanMealSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const app = useApp();
  const ui = useUI();

  const hoy = useMemo(() => new Date(`${app.date}T12:00:00`).getDay(), [app.date]);
  /** Qué cena se está mirando; solo importa si esta comida es la cena. */
  const [weekday, setWeekday] = useState(() => {
    const m = /^plan-cena-(\d)$/.exec(id);
    return m ? Number(m[1]) : hoy;
  });
  const esCena = id.startsWith('plan-cena-');

  const base = useMemo(() => {
    if (esCena) return resolveDinner(dinnerFor(weekday), app.foodsById, app.settings.planOverrides);
    const meal = PLAN_MEALS.find((m) => m.id === id);
    return meal ? resolveMeal(meal, app.foodsById, app.settings.planOverrides) : null;
  }, [esCena, weekday, id, app.foodsById, app.settings.planOverrides]);

  const [lineas, setLineas] = useState<{ foodId: string; grams: number }[]>(
    () => base?.parts.map((p) => ({ foodId: p.food.id, grams: p.grams })) ?? [],
  );
  const [picking, setPicking] = useState(false);

  /** Lo que suman las líneas de ahora mismo. */
  const total: Nutrients = useMemo(() => sumNutrients(lineas.flatMap((l) => {
    const food = app.foodsById.get(l.foodId);
    return food ? [scaleNutrients(food.per100g, l.grams)] : [];
  })), [lineas, app.foodsById]);

  if (!base) {
    return <Sheet title="Comida" onClose={onClose}><p className="note">No encuentro esa comida del plan.</p></Sheet>;
  }

  if (picking) {
    return (
      <FoodPicker
        title={`Añadir a ${base.name}`}
        onClose={() => setPicking(false)}
        onPick={(food: Food) => {
          const porcion = food.portions.find((p) => p.isDefault) ?? food.portions[0];
          setLineas((prev) => [...prev, { foodId: food.id, grams: Math.round(porcion?.grams ?? 100) }]);
          setPicking(false);
        }}
      />
    );
  }

  const cambiar = (i: number, grams: number) =>
    setLineas((prev) => prev.map((l, j) => (j === i ? { ...l, grams } : l)));

  const registrar = async () => {
    const partes = lineas.flatMap((l) => {
      const food = app.foodsById.get(l.foodId);
      return food ? [{ food, grams: l.grams, nutrients: scaleNutrients(food.per100g, l.grams) }] : [];
    });
    const entryId = await app.actions.logPlanMeal({ ...base, parts: partes, nutrients: total });
    onClose();
    if (entryId) {
      ui.notify(`${base.name} · ${g(total.kcal)} kcal`, () => app.actions.deleteEntry(entryId));
    }
  };

  const guardarBase = async () => {
    await app.actions.setPlanOverride(base.id, lineas);
    ui.notify('Guardado. A partir de ahora el plan usa tus cantidades.');
  };

  const volverAlPlan = async () => {
    await app.actions.setPlanOverride(base.id, null);
    const limpio = esCena
      ? resolveDinner(dinnerFor(weekday), app.foodsById)
      : resolveMeal(PLAN_MEALS.find((m) => m.id === id)!, app.foodsById);
    setLineas(limpio.parts.map((p) => ({ foodId: p.food.id, grams: p.grams })));
    ui.notify('Vuelta a las cantidades de tu hoja.');
  };

  return (
    <Sheet
      title={base.name}
      subtitle={`${g(total.kcal)} kcal · ${g(total.protein)} g de proteína`}
      onClose={onClose}
      footer={
        <div className="btns">
          <button className="btn" onClick={() => void guardarBase()}>Guardar cantidades</button>
          <button className="btn primary" disabled={!lineas.length} onClick={() => void registrar()}>
            Registrar
          </button>
        </div>
      }
    >
      {/* La cena se elige: la hoja deja cambiarla por cualquiera de la rotación,
          y es la única variedad que el plan ya autoriza. */}
      {esCena && (
        <div className="field">
          <span className="field-label">Qué cenas</span>
          <div className="chips">
            {PLAN_DINNERS.map((d) => (
              <button key={d.weekday} className="chip" aria-pressed={d.weekday === weekday}
                onClick={() => {
                  setWeekday(d.weekday);
                  const otra = resolveDinner(d, app.foodsById, app.settings.planOverrides);
                  setLineas(otra.parts.map((p) => ({ foodId: p.food.id, grams: p.grams })));
                }}>
                {d.name}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <span className="field-label">Cantidades</span>
        <div className="qty-list">
          {lineas.map((l, i) => {
            const food = app.foodsById.get(l.foodId);
            const n = food ? scaleNutrients(food.per100g, l.grams) : null;
            return (
              <div className="qty-row" key={`${l.foodId}-${i}`}>
                <div className="qty-body">
                  <div className="qty-name">{food?.name ?? l.foodId}</div>
                  <div className="qty-meta">{n ? `${g(n.kcal)} kcal · ${g(n.protein)} g prot` : '—'}</div>
                </div>
                <div className="qty-input">
                  <button className="qty-step" aria-label={`Bajar 10 gramos de ${food?.name ?? ''}`}
                    onClick={() => cambiar(i, Math.max(0, l.grams - 10))}>−</button>
                  <input
                    className="input"
                    inputMode="numeric"
                    value={String(l.grams)}
                    aria-label={`Gramos de ${food?.name ?? l.foodId}`}
                    onChange={(e) => {
                      const raw = e.target.value.replace(/[^\d]/g, '');
                      cambiar(i, raw === '' ? 0 : Math.min(3000, Number(raw)));
                    }}
                  />
                  <span className="qty-unit">{food?.unit ?? 'g'}</span>
                  <button className="qty-step" aria-label={`Subir 10 gramos de ${food?.name ?? ''}`}
                    onClick={() => cambiar(i, Math.min(3000, l.grams + 10))}>+</button>
                </div>
                <button className="icon-btn" aria-label={`Quitar ${food?.name ?? 'el alimento'}`}
                  onClick={() => setLineas((prev) => prev.filter((_, j) => j !== i))}>
                  <Icon name="trash" size={16} />
                </button>
              </div>
            );
          })}
        </div>
        <button className="btn-outline" style={{ marginTop: 10 }} onClick={() => setPicking(true)}>
          <Icon name="plus" size={16} /> Añadir un alimento
        </button>
      </div>

      <p className="note tight">{base.note}</p>

      {base.edited && (
        <button className="btn quiet sm" style={{ marginTop: 10 }} onClick={() => void volverAlPlan()}>
          Volver a las cantidades de mi hoja
        </button>
      )}
    </Sheet>
  );
}
