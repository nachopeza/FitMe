import { useMemo, useState } from 'react';
import { addNutrients, scaleNutrients } from '../../domain/nutrition';
import { searchFoods } from '../../domain/parser';
import { substitutionsFor } from '../../domain/recommender';
import { weekStart, addDays } from '../../domain/dates';
import { EMPTY_NUTRIENTS, MACRO_KEYS, type Food, type FoodCategory, type Nutrients } from '../../domain/types';
import { Field, MACRO_META, MacroPills, NumberInput, Sheet, g } from '../../ui/components';
import { useApp } from '../store';

// ───────────────────────────── Calculadora nutricional ─────────────────────────────

/**
 * Calculadora: se meten cantidades y todo se recalcula al instante.
 * Útil para responder «¿puedo comer dos fajitas?» antes de comerlas.
 */
export function CalculatorSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [rows, setRows] = useState<{ foodId: string; grams: number }[]>([]);
  const [query, setQuery] = useState('');

  const results = useMemo(
    () => (query.trim().length >= 2 ? searchFoods(query, app.foods, 12) : []),
    [query, app.foods],
  );

  const total = useMemo(
    () =>
      rows.reduce<Nutrients>((acc, r) => {
        const f = app.foodsById.get(r.foodId);
        return f ? addNutrients(acc, scaleNutrients(f.per100g, r.grams)) : acc;
      }, { ...EMPTY_NUTRIENTS }),
    [rows, app.foodsById],
  );

  return (
    <Sheet title="🧮 Calculadora" subtitle="Cambia una cantidad y se recalcula todo" onClose={onClose}>
      <input className="input" value={query} onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar alimento…" aria-label="Buscar alimento" />
      {results.length > 0 && (
        <div className="list" style={{ marginTop: 8 }}>
          {results.map((f) => (
            <button className="row" key={f.id} onClick={() => {
              const portion = f.portions.find((p) => p.isDefault) ?? f.portions[0];
              setRows((prev) => [...prev, { foodId: f.id, grams: portion?.grams ?? 100 }]);
              setQuery('');
            }}>
              <div className="row-main">
                <div className="row-title" style={{ fontSize: '0.88rem' }}>{f.name}</div>
                <div className="row-sub">{g(f.per100g.kcal)} kcal / 100 {f.unit}</div>
              </div>
              <span aria-hidden="true">+</span>
            </button>
          ))}
        </div>
      )}

      {rows.length === 0 ? (
        <div className="empty"><span className="ico" aria-hidden="true">🧮</span>Añade alimentos para sumar sus macros.</div>
      ) : (
        <div className="card tight" style={{ marginTop: 12 }}>
          {rows.map((r, idx) => {
            const food = app.foodsById.get(r.foodId);
            if (!food) return null;
            const n = scaleNutrients(food.per100g, r.grams);
            return (
              <div key={idx} style={{ borderBottom: '1px solid var(--line)', padding: '9px 0' }}>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="row-title" style={{ fontSize: '0.88rem' }}>{food.name}</div>
                    <div className="row-sub">
                      {g(n.kcal)} kcal · {g(n.protein)} g prot · {g(n.carbs)} g carb · {g(n.fat)} g gras
                    </div>
                  </div>
                  <button className="icon-btn" aria-label="Quitar"
                    onClick={() => setRows((prev) => prev.filter((_, j) => j !== idx))}>🗑️</button>
                </div>
                <div className="input-row" style={{ marginTop: 6 }}>
                  <input className="input" type="number" inputMode="decimal" value={r.grams} step={5} min={0}
                    aria-label={`Cantidad de ${food.name}`}
                    onChange={(e) => setRows((prev) => prev.map((x, j) => (j === idx ? { ...x, grams: Math.max(0, Number(e.target.value)) } : x)))} />
                  <span className="suffix">{food.unit}</span>
                </div>
                <div className="chips" style={{ marginTop: 6 }}>
                  {food.portions.map((p) => (
                    <button key={p.label} className="chip" aria-pressed={r.grams === p.grams}
                      onClick={() => setRows((prev) => prev.map((x, j) => (j === idx ? { ...x, grams: p.grams } : x)))}>
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {rows.length > 0 && (
        <div className="card tight">
          <div className="card-title"><span>Total</span></div>
          <MacroPills n={total} />
          <div className="note">
            Sería el {Math.round((total.kcal / Math.max(1, app.targets.kcal.target)) * 100)}% de tus calorías de
            hoy y el {Math.round((total.protein / Math.max(1, app.targets.protein.target)) * 100)}% de tu proteína.
            {total.kcal <= app.remaining.kcal
              ? ' Te cabe en lo que te queda.'
              : ` Son ${g(total.kcal - app.remaining.kcal)} kcal más de lo que te quedaba: tampoco pasa nada, pero que lo sepas.`}
          </div>
        </div>
      )}
    </Sheet>
  );
}

// ───────────────────────────── Comparador ─────────────────────────────

export function CompareSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [left, setLeft] = useState<Food | null>(app.foodsById.get('arroz-cocido') ?? null);
  const [right, setRight] = useState<Food | null>(app.foodsById.get('patata-cocida') ?? null);
  const [basis, setBasis] = useState<'100' | 'portion'>('100');
  const [target, setTarget] = useState<'left' | 'right'>('left');
  const [query, setQuery] = useState('');

  const results = useMemo(
    () => (query.trim().length >= 2 ? searchFoods(query, app.foods, 10) : []),
    [query, app.foods],
  );

  const amountOf = (f: Food | null) => {
    if (!f) return 0;
    if (basis === '100') return 100;
    return (f.portions.find((p) => p.isDefault) ?? f.portions[0])?.grams ?? 100;
  };

  const nl = left ? scaleNutrients(left.per100g, amountOf(left)) : null;
  const nr = right ? scaleNutrients(right.per100g, amountOf(right)) : null;

  return (
    <Sheet title="⚖️ Comparador" subtitle="Por 100 g o por ración" onClose={onClose}>
      <div className="seg" style={{ marginBottom: 12 }}>
        <button aria-pressed={basis === '100'} onClick={() => setBasis('100')}>Por 100 g</button>
        <button aria-pressed={basis === 'portion'} onClick={() => setBasis('portion')}>Por ración</button>
      </div>

      <div className="grid-2" style={{ marginBottom: 12 }}>
        <button className="stat" style={{ textAlign: 'left', borderColor: target === 'left' ? 'var(--accent)' : undefined }}
          onClick={() => setTarget('left')}>
          <div className="stat-label">Alimento A</div>
          <div className="stat-value" style={{ fontSize: '0.86rem' }}>{left?.name ?? 'Elegir'}</div>
          {basis === 'portion' && left && <div className="stat-sub">{amountOf(left)} {left.unit}</div>}
        </button>
        <button className="stat" style={{ textAlign: 'left', borderColor: target === 'right' ? 'var(--accent)' : undefined }}
          onClick={() => setTarget('right')}>
          <div className="stat-label">Alimento B</div>
          <div className="stat-value" style={{ fontSize: '0.86rem' }}>{right?.name ?? 'Elegir'}</div>
          {basis === 'portion' && right && <div className="stat-sub">{amountOf(right)} {right.unit}</div>}
        </button>
      </div>

      <Field label={`Buscar para el alimento ${target === 'left' ? 'A' : 'B'}`}>
        <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="arroz, patata, pollo, atún…" />
      </Field>
      {results.length > 0 && (
        <div className="list" style={{ marginBottom: 12 }}>
          {results.map((f) => (
            <button className="row" key={f.id} onClick={() => {
              if (target === 'left') setLeft(f); else setRight(f);
              setQuery('');
            }}>
              <div className="row-main"><div className="row-title" style={{ fontSize: '0.88rem' }}>{f.name}</div></div>
              <span aria-hidden="true">→</span>
            </button>
          ))}
        </div>
      )}

      {nl && nr && left && right && (
        <div className="card tight">
          <div className="card-title"><span>{basis === '100' ? 'Por 100 g' : 'Por ración'}</span></div>
          {MACRO_KEYS.map((k) => {
            const a = nl[k];
            const b = nr[k];
            const max = Math.max(a, b, 0.001);
            return (
              <div className="macro" key={k}>
                <div className="macro-head">
                  <span className="macro-name">{MACRO_META[k].icon} {MACRO_META[k].label}</span>
                  <span className="macro-val"><b>{g(a)}</b> <span>vs</span> <b>{g(b)}</b></span>
                </div>
                <div style={{ display: 'flex', gap: 4 }}>
                  <div className="bar" style={{ flex: 1 }}>
                    <span className="bar-fill" style={{ width: `${(a / max) * 100}%`, background: MACRO_META[k].color }} />
                  </div>
                  <div className="bar" style={{ flex: 1 }}>
                    <span className="bar-fill" style={{ width: `${(b / max) * 100}%`, background: MACRO_META[k].color, opacity: 0.6 }} />
                  </div>
                </div>
              </div>
            );
          })}
          <p className="note" style={{ marginTop: 10, marginBottom: 0 }}>
            {compareVerdict(left, right, nl, nr)}
          </p>
        </div>
      )}

      {left && (
        <div className="card tight">
          <div className="card-title"><span>Sustituciones de {left.name.replace(/\([^)]*\)/g, '').trim()}</span></div>
          <div className="list">
            {substitutionsFor(left, amountOf(left), app.foods, 5).map((s) => (
              <button className="row" key={s.food.id} onClick={() => setRight(s.food)}>
                <div className="row-main">
                  <div className="row-title" style={{ fontSize: '0.85rem' }}>{s.food.name}</div>
                  <div className="row-sub">{s.note}</div>
                </div>
                <div className="row-side">{s.grams} g</div>
              </button>
            ))}
          </div>
        </div>
      )}
    </Sheet>
  );
}

/** Una frase útil, sin juicios morales sobre los alimentos. */
function compareVerdict(a: Food, b: Food, na: Nutrients, nb: Nutrients): string {
  const nameA = a.name.replace(/\([^)]*\)/g, '').trim().toLowerCase();
  const nameB = b.name.replace(/\([^)]*\)/g, '').trim().toLowerCase();
  const parts: string[] = [];
  const dProtein = na.protein - nb.protein;
  if (Math.abs(dProtein) >= 2) {
    parts.push(`${dProtein > 0 ? nameA : nameB} aporta ${g(Math.abs(dProtein))} g más de proteína`);
  }
  const dKcal = na.kcal - nb.kcal;
  if (Math.abs(dKcal) >= 15) {
    parts.push(`${dKcal > 0 ? nameA : nameB} tiene ${g(Math.abs(dKcal))} kcal más`);
  }
  const dFiber = na.fiber - nb.fiber;
  if (Math.abs(dFiber) >= 1.5) {
    parts.push(`${dFiber > 0 ? nameA : nameB} tiene más fibra`);
  }
  if (!parts.length) return 'Son bastante equivalentes: elige por gusto o por lo que tengas en casa.';
  return `${parts.join('; ')}. Ninguno es «mejor»: depende de lo que te falte hoy.`;
}

// ───────────────────────────── Lista de la compra ─────────────────────────────

const CATEGORY_GROUP: { key: FoodCategory[]; label: string; icon: string }[] = [
  { key: ['protein'], label: 'Proteínas', icon: '🥩' },
  { key: ['carb'], label: 'Carbohidratos', icon: '🍚' },
  { key: ['vegetable'], label: 'Verduras', icon: '🥦' },
  { key: ['fruit'], label: 'Frutas', icon: '🍌' },
  { key: ['dairy'], label: 'Lácteos y alternativas', icon: '🥛' },
  { key: ['fat'], label: 'Grasas', icon: '🥑' },
  { key: ['drink', 'other'], label: 'Otros', icon: '⭐' },
];

/**
 * Lista de la compra generada a partir de lo que el usuario come de verdad:
 * frecuencia de consumo de las últimas semanas, sus recetas y sus comidas
 * habituales, escalado a los días que quiera cubrir.
 */
export function ShoppingSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [days, setDays] = useState<number | ''>(7);
  const [checked, setChecked] = useState<Set<string>>(new Set());

  const plan = useMemo(() => {
    const horizon = days === '' ? 7 : days;
    const from = addDays(weekStart(new Date().toISOString().slice(0, 10)), -21);
    const recent = app.history.entries.filter((e) => e.date >= from);

    // Gramos por día de cada alimento, según lo realmente registrado.
    const grams = new Map<string, number>();
    const daysWithData = new Set(recent.map((e) => e.date)).size || 1;
    for (const e of recent) {
      for (const i of e.items) {
        grams.set(i.foodId, (grams.get(i.foodId) ?? 0) + i.grams);
      }
    }

    // Las recetas y comidas habituales aseguran que no falte lo básico aunque
    // haya pocos días registrados todavía.
    for (const r of app.recipes) {
      const weight = Math.min(3, 1 + r.useCount / 5);
      for (const ing of r.ingredients) {
        grams.set(ing.foodId, (grams.get(ing.foodId) ?? 0) + (ing.grams / Math.max(1, r.servings)) * weight);
      }
    }
    for (const m of app.savedMeals) {
      const weight = Math.min(3, 1 + m.useCount / 5);
      for (const i of m.items) grams.set(i.foodId, (grams.get(i.foodId) ?? 0) + i.grams * weight);
    }

    const scale = horizon / Math.max(daysWithData, 3);
    const items = [...grams.entries()]
      .map(([foodId, total]) => {
        const food = app.foodsById.get(foodId);
        if (!food) return null;
        const needed = Math.round((total * scale) / 10) * 10;
        if (needed < 20) return null;
        return { food, grams: needed };
      })
      .filter((x): x is { food: Food; grams: number } => !!x)
      .sort((a, b) => b.grams - a.grams);

    return { items, daysWithData };
  }, [days, app.history.entries, app.recipes, app.savedMeals, app.foodsById]);

  const toggle = (id: string) =>
    setChecked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const copyText = () =>
    CATEGORY_GROUP.map((group) => {
      const rows = plan.items.filter((i) => group.key.includes(i.food.category));
      if (!rows.length) return '';
      return `${group.icon} ${group.label.toUpperCase()}\n${rows
        .map((r) => `- ${r.food.name.replace(/\([^)]*\)/g, '').trim()}: ${formatAmount(r.grams, r.food)}`)
        .join('\n')}`;
    })
      .filter(Boolean)
      .join('\n\n');

  return (
    <Sheet
      title="🛒 Lista de la compra"
      subtitle="Generada con lo que comes de verdad"
      onClose={onClose}
      footer={
        <button className="btn" disabled={!plan.items.length} onClick={async () => {
          try {
            await navigator.clipboard.writeText(copyText());
          } catch {
            // Sin permiso de portapapeles no se puede hacer nada más: se ignora.
          }
        }}>Copiar la lista</button>
      }
    >
      <Field label="¿Para cuántos días?">
        <NumberInput value={days} min={1} max={30} suffix="días" onChange={setDays} />
      </Field>

      {plan.items.length === 0 ? (
        <div className="empty">
          <span className="ico" aria-hidden="true">🛒</span>
          Todavía no hay suficiente historial.
          <br />Registra unos días de comidas o crea alguna receta y la lista se genera sola.
        </div>
      ) : (
        <>
          <p className="note">
            Basada en {plan.daysWithData} días con registro de las últimas 3 semanas, tus recetas y tus comidas
            habituales. Son cantidades orientativas: ajusta según lo que te quede en casa.
          </p>
          {CATEGORY_GROUP.map((group) => {
            const rows = plan.items.filter((i) => group.key.includes(i.food.category));
            if (!rows.length) return null;
            return (
              <div className="card tight" key={group.label}>
                <div className="card-title"><span>{group.icon} {group.label}</span></div>
                <div className="list">
                  {rows.map((r) => (
                    <button className="row" key={r.food.id} onClick={() => toggle(r.food.id)}>
                      <span aria-hidden="true" style={{ fontSize: '1.05rem' }}>
                        {checked.has(r.food.id) ? '☑️' : '⬜'}
                      </span>
                      <div className="row-main">
                        <div className="row-title" style={{
                          fontSize: '0.88rem',
                          textDecoration: checked.has(r.food.id) ? 'line-through' : undefined,
                          opacity: checked.has(r.food.id) ? 0.5 : 1,
                        }}>
                          {r.food.name.replace(/\([^)]*\)/g, '').trim()}
                        </div>
                      </div>
                      <div className="row-side">{formatAmount(r.grams, r.food)}</div>
                    </button>
                  ))}
                </div>
              </div>
            );
          })}
        </>
      )}
    </Sheet>
  );
}

/**
 * Presenta la cantidad en la unidad en que se compra: los huevos en docenas,
 * la carne en kilos, no en «1.120 g de huevo».
 */
function formatAmount(grams: number, food: Food): string {
  const unitPortion = food.portions.find((p) => /unidad|loncha|lata|bola|tarrina/.test(p.label.toLowerCase()));
  if (unitPortion) {
    const units = Math.ceil(grams / unitPortion.grams);
    return `${units} ${unitPortion.label}${units === 1 ? '' : 's'}`;
  }
  if (grams >= 1000) return `${(grams / 1000).toFixed(1).replace('.', ',')} kg`;
  return `${grams} ${food.unit}`;
}
