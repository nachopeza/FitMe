import { useMemo, useState, type ReactNode } from 'react';
import { searchFoods } from '../../domain/parser';
import { nowTime } from '../../domain/dates';
import { MEAL_SLOTS, MEAL_SLOT_LABEL, type Food, type LoggedItem, type MealEntry, type MealSlot } from '../../domain/types';
import { EstimateNotice, MACRO_META, MacroPills, Sheet, g } from '../../ui/components';
import { useUI } from '../../ui/shell';
import { slotForTime, useApp } from '../store';
import { CONFIDENCE_LABEL, itemsNutrients, makeItem, reviseItem } from '../logging';

/**
 * Pantalla de confirmación común a todas las vías de registro.
 *
 * Es deliberadamente la misma para voz, foto, código de barras y manual: en las
 * cuatro la app muestra QUÉ HA ENTENDIDO y con qué confianza, y nada se guarda
 * hasta que el usuario lo confirma.
 */

interface Props {
  title: string;
  subtitle?: string;
  initialItems: LoggedItem[];
  /** Fragmentos que no se han podido identificar. Se muestran, no se ocultan. */
  unmatched?: string[];
  sourceNote?: string;
  method: MealEntry['method'];
  slot?: MealSlot;
  recipeId?: string;
  /** Aviso específico de la vía de captura (foto, voz…). */
  notice?: ReactNode;
  onClose: () => void;
}

export function ConfirmEntry({
  title, subtitle, initialItems, unmatched = [], sourceNote, method, slot, recipeId, notice, onClose,
}: Props) {
  const app = useApp();
  const ui = useUI();
  const [items, setItems] = useState<LoggedItem[]>(initialItems);
  const [time, setTime] = useState(nowTime());
  const [mealSlot, setMealSlot] = useState<MealSlot>(
    slot ?? slotForTime(nowTime(), app.profile?.mealTimes ?? {}),
  );
  const [name, setName] = useState('');
  const [query, setQuery] = useState('');
  const [saveAsMeal, setSaveAsMeal] = useState(false);
  const [saving, setSaving] = useState(false);

  const totals = useMemo(() => itemsNutrients(items), [items]);
  const results = useMemo(
    () => (query.trim().length >= 2 ? searchFoods(query, app.foods, 12) : []),
    [query, app.foods],
  );

  /** "No sé": vuelve a la ración por defecto y baja la confianza a aproximada. */
  const setUnknown = (id: string) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const food = app.foodsById.get(it.foodId);
        if (!food) return it;
        const portion = food.portions.find((p) => p.isDefault) ?? food.portions[0];
        const grams = portion?.grams ?? 100;
        return {
          ...reviseItem(it, food, grams),
          quantity: 1,
          unit: 'portion',
          portionLabel: portion?.label,
          confidence: 'rough',
        };
      }),
    );
  };

  const setGrams = (id: string, grams: number) => {
    setItems((prev) =>
      prev.map((it) => {
        if (it.id !== id) return it;
        const food = app.foodsById.get(it.foodId);
        if (!food) return it;
        return reviseItem(it, food, Math.max(0, grams));
      }),
    );
  };

  const addFood = (food: Food) => {
    const portion = food.portions.find((p) => p.isDefault) ?? food.portions[0];
    setItems((prev) => [...prev, makeItem(food, 1, 'portion', { portionLabel: portion?.label, confidence: 'rough' })]);
    setQuery('');
  };

  const save = async () => {
    if (!items.length) return;
    setSaving(true);
    try {
      await app.actions.addEntry({
        date: app.date,
        slot: mealSlot,
        time,
        name: name.trim() || undefined,
        items,
        method,
        sourceNote,
        recipeId,
      });
      if (saveAsMeal) {
        await app.actions.upsertSavedMeal({
          id: `sm-${Date.now().toString(36)}`,
          name: name.trim() || items.map((i) => shortFoodName(i.foodName)).slice(0, 3).join(' + '),
          items: items.map(({ id: _id, ...rest }) => rest),
          slotHint: mealSlot,
          prepMinutes: 10,
          useCount: 1,
          createdAt: Date.now(),
        });
      }
      if (recipeId) await app.actions.markRecipeUsed(recipeId);
      ui.notify('Comida registrada.');
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const hasEstimates = items.some((i) => i.confidence !== 'exact');

  return (
    <Sheet
      title={title}
      subtitle={subtitle}
      onClose={onClose}
      footer={
        <div className="btn-row">
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={!items.length || saving} onClick={() => void save()}>
            {saving ? <span className="spinner" /> : 'Confirmar'}
          </button>
        </div>
      }
    >
      {notice}

      {sourceNote && (
        <div className="card tight" style={{ marginTop: notice ? 12 : 0 }}>
          <div className="card-title"><span>Lo que has dicho</span></div>
          <p className="note" style={{ marginBottom: 0, fontStyle: 'italic' }}>«{sourceNote}»</p>
        </div>
      )}

      {/* ── Items reconocidos, editables uno a uno ── */}
      <div className="card tight">
        <div className="card-title"><span>Alimentos · {items.length}</span></div>
        {items.length === 0 && <p className="note" style={{ marginBottom: 0 }}>Añade al menos un alimento para poder guardar.</p>}
        {items.map((item) => {
          const food = app.foodsById.get(item.foodId);
          return (
            <div key={item.id} style={{ borderBottom: '1px solid var(--line)', padding: '10px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'flex-start' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-title">{item.foodName}</div>
                  <div className="row-sub">
                    {item.confidence !== 'exact' && (
                      <span className="tag warn" style={{ marginRight: 6 }}>≈ {CONFIDENCE_LABEL[item.confidence]}</span>
                    )}
                    {g(item.nutrients.kcal)} kcal · {g(item.nutrients.protein)} g prot
                  </div>
                </div>
                <button className="icon-btn" aria-label={`Quitar ${item.foodName}`}
                  onClick={() => setItems((prev) => prev.filter((i) => i.id !== item.id))}>🗑️</button>
              </div>

              <div className="input-row" style={{ marginTop: 8 }}>
                <input
                  className="input"
                  type="number"
                  inputMode="decimal"
                  value={Math.round(item.grams)}
                  min={0}
                  step={5}
                  aria-label={`Cantidad de ${item.foodName}`}
                  onChange={(e) => setGrams(item.id, Number(e.target.value))}
                />
                <span className="suffix">{food?.unit ?? 'g'}</span>
              </div>

              {/* Opciones de cantidad: raciones reales del alimento primero, y
                  después valores redondos que no repitan ninguna ración. */}
              <div className="chips" style={{ marginTop: 7 }}>
                {(food?.portions ?? []).map((p) => (
                  <button key={p.label} className="chip" aria-pressed={Math.round(item.grams) === p.grams}
                    onClick={() => setGrams(item.id, p.grams)}>
                    {p.label} · {p.grams} {food?.unit ?? 'g'}
                  </button>
                ))}
                {[50, 100, 150, 200, 250]
                  .filter((v) => !(food?.portions ?? []).some((p) => p.grams === v))
                  .map((v) => (
                    <button key={v} className="chip" aria-pressed={Math.round(item.grams) === v}
                      onClick={() => setGrams(item.id, v)}>{v} {food?.unit ?? 'g'}</button>
                  ))}
                {/* "No sé" es una respuesta legítima: deja la ración habitual y
                    marca la cantidad como aproximada en lugar de fingir un dato. */}
                <button
                  className="chip"
                  aria-pressed={item.confidence === 'rough'}
                  onClick={() => setUnknown(item.id)}
                >
                  🤷 No sé
                </button>
              </div>

              {/* Conversión crudo/cocinado cuando el alimento tiene pareja. */}
              {food?.counterpartId && (
                <button
                  className="link-btn"
                  style={{ marginTop: 8 }}
                  onClick={() => {
                    const other = app.foodsById.get(food.counterpartId!);
                    if (!other) return;
                    // Los gramos se convierten con el rendimiento real al cocinar,
                    // nunca 1:1: 80 g de arroz crudo son 200 g cocinado.
                    const factor = food.state === 'raw' ? (food.cookedYield ?? 1) : 1 / (other.cookedYield ?? 1);
                    const grams = Math.max(1, Math.round(item.grams * factor));
                    setItems((prev) =>
                      prev.map((i) =>
                        i.id === item.id
                          ? reviseItem({ ...i, foodId: other.id, foodName: other.name }, other, grams)
                          : i,
                      ),
                    );
                  }}
                >
                  ¿Lo has pesado {food.state === 'raw' ? 'ya cocinado' : 'en crudo'}? Cambiar y convertir los gramos
                </button>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Lo que no se ha reconocido ── */}
      {unmatched.length > 0 && (
        <div className="card tight">
          <div className="card-title"><span>No lo he reconocido</span></div>
          <p className="note">
            Esto no lo tengo en la base de alimentos, así que no lo he inventado. Búscalo abajo y añádelo:
          </p>
          <div className="chips">
            {unmatched.map((u, i) => (
              <button key={i} className="chip" onClick={() => setQuery(u)}>«{u}»</button>
            ))}
          </div>
        </div>
      )}

      {/* ── Añadir más ── */}
      <div className="card tight">
        <div className="card-title"><span>Añadir alimento</span></div>
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar: arroz, pollo, huevos…" aria-label="Buscar alimento" />
        {results.length > 0 && (
          <div className="list" style={{ marginTop: 8 }}>
            {results.map((f) => (
              <button className="row" key={f.id} onClick={() => addFood(f)}>
                <div className="row-main">
                  <div className="row-title">{f.name}</div>
                  <div className="row-sub">
                    {g(f.per100g.kcal)} kcal · {g(f.per100g.protein)} g prot por 100 {f.unit}
                  </div>
                </div>
                <span aria-hidden="true">+</span>
              </button>
            ))}
          </div>
        )}
        {query.trim().length >= 2 && results.length === 0 && (
          <p className="note" style={{ marginTop: 8, marginBottom: 0 }}>
            No encontrado. Puedes crearlo escaneando su etiqueta desde el botón + → Etiqueta.
          </p>
        )}
      </div>

      {/* ── Totales ── */}
      <div className="card tight">
        <div className="card-title"><span>Total de la comida</span></div>
        <MacroPills n={totals} />
        <div className="note">
          Supone un {Math.round((totals.kcal / Math.max(1, app.targets.kcal.target)) * 100)}% de tu objetivo de
          calorías de hoy y un {Math.round((totals.protein / Math.max(1, app.targets.protein.target)) * 100)}% de tu proteína.
        </div>
        {hasEstimates && (
          <div style={{ marginTop: 10 }}>
            <EstimateNotice>
              Hay cantidades estimadas, marcadas con <b>≈</b>. Si conoces el dato real, cámbialo: mejora la
              precisión de hoy y también lo que la app aprende de ti.
            </EstimateNotice>
          </div>
        )}
      </div>

      {/* ── Cuándo y cómo se guarda ── */}
      <div className="card tight">
        <div className="card-title"><span>Detalles</span></div>
        <div className="field">
          <label>Comida</label>
          <div className="chips">
            {MEAL_SLOTS.map((s) => (
              <button key={s} className="chip" aria-pressed={mealSlot === s} onClick={() => setMealSlot(s)}>
                {MEAL_SLOT_LABEL[s]}
              </button>
            ))}
          </div>
        </div>
        <div className="field">
          <label>Hora</label>
          <input className="input" type="time" value={time} onChange={(e) => setTime(e.target.value)} />
        </div>
        <div className="field">
          <label>Nombre (opcional)</label>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Arroz de siempre" />
          <div className="hint">Ponerle nombre te permite repetirla después de un toque.</div>
        </div>
        <button className="chip" aria-pressed={saveAsMeal} onClick={() => setSaveAsMeal((v) => !v)}>
          ⭐ Guardar como comida habitual
        </button>
      </div>

      <div className="grid-3" style={{ marginBottom: 8 }}>
        {(['protein', 'carbs', 'fat'] as const).map((k) => (
          <div className="stat" key={k}>
            <div className="stat-label">{MACRO_META[k].icon} {MACRO_META[k].short}</div>
            <div className="stat-value">{g(totals[k])} g</div>
          </div>
        ))}
      </div>
    </Sheet>
  );
}

export function shortFoodName(name: string): string {
  return name.replace(/\([^)]*\)/g, '').trim();
}
