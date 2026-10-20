import { useMemo, useState } from 'react';
import {
  defaultChoice, describeChoice, getComposition, isSlotHidden, resolveComposition,
  type CompositionChoice,
} from '../../data/compositions';
import { nowTime } from '../../domain/dates';
import { scaleNutrients, sumNutrients } from '../../domain/nutrition';
import { EMPTY_NUTRIENTS, MEAL_SLOTS, MEAL_SLOT_LABEL, type LoggedItem, type MealSlot } from '../../domain/types';
import { MacroPills, Sheet, g } from '../../ui/components';
import { useUI } from '../../ui/shell';
import { slotForTime, useApp } from '../store';

/**
 * Constructor de un básico del día: café, tostada, yogur, bocadillo, batido.
 *
 * El resultado se guarda además como comida habitual, así que la próxima vez
 * aparece en la pantalla de hoy y se añade de un toque. El constructor se usa
 * una vez por variante; a partir de ahí, un toque.
 */
export function CompositionSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const app = useApp();
  const ui = useUI();
  const comp = getComposition(id);
  const [choice, setChoice] = useState<CompositionChoice>(() => (comp ? defaultChoice(comp) : {}));
  const [saving, setSaving] = useState(false);

  const resolved = useMemo(
    () => (comp ? resolveComposition(comp, choice) : []),
    [comp, choice],
  );

  const items = useMemo<LoggedItem[]>(
    () =>
      resolved.flatMap((part, i) => {
        const food = app.foodsById.get(part.foodId);
        if (!food) return [];
        return [{
          id: `c-${i}-${Date.now().toString(36)}`,
          foodId: food.id,
          foodName: food.name,
          quantity: part.grams,
          unit: food.unit,
          grams: part.grams,
          // Las cantidades de una composición son las raciones declaradas:
          // un vaso de leche es un vaso, no una estimación a ojo.
          confidence: 'exact' as const,
          nutrients: scaleNutrients(food.per100g, part.grams),
        }];
      }),
    [resolved, app.foodsById],
  );

  const totals = useMemo(
    () => (items.length ? sumNutrients(items.map((i) => i.nutrients)) : { ...EMPTY_NUTRIENTS }),
    [items],
  );

  if (!comp) return <Sheet title="Composición" onClose={onClose}><p className="note">No encontrada.</p></Sheet>;

  const name = describeChoice(comp, choice);

  const toggle = (slotId: string, optionId: string, multi: boolean) => {
    setChoice((prev) => {
      const current = prev[slotId] ?? [];
      if (!multi) return { ...prev, [slotId]: [optionId] };
      return {
        ...prev,
        [slotId]: current.includes(optionId) ? current.filter((x) => x !== optionId) : [...current, optionId],
      };
    });
  };

  const save = async (alsoRemember: boolean) => {
    if (!items.length) return;
    setSaving(true);
    try {
      const time = nowTime();
      const slot: MealSlot = comp.slotHint ?? slotForTime(time, app.profile?.mealTimes ?? {});
      const entryId = await app.actions.addEntry({
        date: app.date, slot, time, name, items, method: 'saved',
      });
      if (alsoRemember) await app.actions.rememberMeal(name, items, slot, comp.prepMinutes);
      ui.notify(`${name} · ${g(totals.kcal)} kcal`, () => app.actions.deleteEntry(entryId));
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Sheet
      title={comp.name}
      subtitle={comp.tagline}
      onClose={onClose}
      footer={
        <>
          <div className="estimate" style={{ marginBottom: 10 }}>
            <div>
              <b>{name}</b>
              <div style={{ marginTop: 2 }}>
                {g(totals.kcal)} kcal · {g(totals.protein)} g de proteína
              </div>
            </div>
          </div>
          <button className="btn primary" disabled={!items.length || saving} onClick={() => void save(true)}>
            {saving ? <span className="spinner" /> : 'Añadir y recordar'}
          </button>
          <button className="btn quiet sm" style={{ marginTop: 8 }} disabled={!items.length || saving}
            onClick={() => void save(false)}>
            Añadir solo esta vez
          </button>
        </>
      }
    >
      {comp.slots.map((slot) => {
        if (isSlotHidden(slot, choice)) return null;
        const picked = choice[slot.id] ?? [];
        return (
          <div className="field" key={slot.id}>
            <span className="field-label">
              {slot.label}
              {slot.multi && <span style={{ color: 'var(--ink-3)', fontWeight: 400 }}> · los que lleve</span>}
            </span>
            <div className="chips">
              {slot.options.map((option) => (
                <button
                  key={option.id}
                  className="chip"
                  aria-pressed={picked.includes(option.id)}
                  onClick={() => toggle(slot.id, option.id, !!slot.multi)}
                >
                  {option.label}
                  {option.note && (
                    <span style={{ color: 'var(--ink-3)', fontWeight: 400, marginLeft: 4 }}>{option.note}</span>
                  )}
                </button>
              ))}
            </div>
          </div>
        );
      })}

      <div className="section" style={{ marginTop: 24 }}>
        <div className="section-head">
          <h2 className="section-title">Lo que se va a registrar</h2>
          <span className="section-aside">{MEAL_SLOT_LABEL[comp.slotHint ?? 'extra']}</span>
        </div>
        {items.length === 0 ? (
          <p className="note">Marca al menos una opción.</p>
        ) : (
          <>
            <MacroPills n={totals} />
            <div className="rows">
              {items.map((item) => (
                <div className="row" key={item.id}>
                  <div className="row-body">
                    <div className="row-name">{item.foodName.replace(/\([^)]*\)/g, '').trim()}</div>
                  </div>
                  <div className="row-num">
                    {Math.round(item.grams)} {app.foodsById.get(item.foodId)?.unit ?? 'g'}
                    <small>{g(item.nutrients.kcal)} kcal</small>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      <p className="note tight" style={{ marginTop: 18 }}>
        «Añadir y recordar» lo guarda como comida habitual: a partir de mañana aparece en Hoy y se registra de
        un solo toque. Las franjas disponibles son {MEAL_SLOTS.filter((s) => s !== 'extra').map((s) => MEAL_SLOT_LABEL[s].toLowerCase()).join(', ')}.
      </p>
    </Sheet>
  );
}
