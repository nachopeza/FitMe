import { useMemo, useState } from 'react';
import { addNutrients, scaleNutrients } from '../../domain/nutrition';
import { searchFoods } from '../../domain/parser';
import { substitutionsFor } from '../../domain/recommender';
import { EMPTY_NUTRIENTS, type Food, type Nutrients, type Recipe } from '../../domain/types';
import { Field, MacroPills, NumberInput, Sheet, g } from '../../ui/components';
import { useUI } from '../../ui/shell';
import { useApp } from '../store';
import { ConfirmEntry } from '../capture/ConfirmEntry';

/** Macros de una receta completa y por ración. */
export function recipeNutrients(r: Pick<Recipe, 'ingredients' | 'servings'>, foods: Map<string, Food>) {
  const total = r.ingredients.reduce<Nutrients>((acc, ing) => {
    const f = foods.get(ing.foodId);
    return f ? addNutrients(acc, scaleNutrients(f.per100g, ing.grams)) : acc;
  }, { ...EMPTY_NUTRIENTS });
  const servings = Math.max(1, r.servings);
  const perServing = scaleNutrients(total, 100 / servings);
  return { total, perServing };
}

/**
 * Recetas: lista, edición y registro de una ración.
 * Al registrarla se cuenta un uso, que es lo que permite a la app aprender que
 * "mi arroz de siempre" es una de tus comidas reales.
 */
export function RecipeSheet({ id, onClose }: { id?: string; onClose: () => void }) {
  const app = useApp();
  const ui = useUI();
  const [editing, setEditing] = useState<Recipe | null>(
    id ? app.recipes.find((r) => r.id === id) ?? null : null,
  );
  const [logging, setLogging] = useState<Recipe | null>(null);

  if (logging) {
    const { perServing } = recipeNutrients(logging, app.foodsById);
    const factor = 1 / Math.max(1, logging.servings);
    return (
      <ConfirmEntry
        title={logging.name}
        subtitle="Una ración"
        initialItems={logging.ingredients.flatMap((ing, idx) => {
          const food = app.foodsById.get(ing.foodId);
          if (!food) return [];
          const grams = Math.round(ing.grams * factor);
          return [{
            id: `r-${idx}-${Date.now().toString(36)}`,
            foodId: food.id,
            foodName: food.name,
            quantity: grams,
            unit: food.unit,
            grams,
            confidence: 'exact' as const,
            nutrients: scaleNutrients(food.per100g, grams),
          }];
        })}
        method="recipe"
        recipeId={logging.id}
        onClose={onClose}
        notice={
          <div className="card tight">
            <div className="card-title"><span>Por ración</span></div>
            <MacroPills n={perServing} />
          </div>
        }
      />
    );
  }

  if (editing !== null) {
    return <RecipeEditor recipe={editing} onClose={() => setEditing(null)} />;
  }

  return (
    <Sheet title="📖 Recetas" subtitle="Calcula los macros una vez y reutilízala" onClose={onClose}
      footer={<button className="btn primary" onClick={() => setEditing(emptyRecipe())}>+ Nueva receta</button>}>
      {app.recipes.length === 0 ? (
        <div className="empty">
          <span className="ico" aria-hidden="true">📖</span>
          Todavía no tienes recetas.
          <br />Crea «Arroz de siempre» una vez y luego la añades de un toque.
        </div>
      ) : (
        <div className="list">
          {[...app.recipes]
            .sort((a, b) => b.useCount - a.useCount || b.createdAt - a.createdAt)
            .map((r) => {
              const { perServing } = recipeNutrients(r, app.foodsById);
              return (
                <div className="row" key={r.id}>
                  <button className="row-main" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }}
                    onClick={() => setLogging(r)}>
                    <div className="row-title">{r.name}</div>
                    <div className="row-sub">
                      {r.servings} {r.servings === 1 ? 'ración' : 'raciones'} · {r.prepMinutes} min · usada {r.useCount} {r.useCount === 1 ? 'vez' : 'veces'}
                    </div>
                  </button>
                  <div className="row-side">
                    {g(perServing.kcal)} kcal<br />
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>{g(perServing.protein)} g prot</span>
                  </div>
                  <button className="icon-btn" aria-label={`Editar ${r.name}`} onClick={() => setEditing(r)}>✏️</button>
                </div>
              );
            })}
        </div>
      )}
      <p className="note" style={{ marginTop: 12 }}>
        Con una receta guardada puedes decir por voz «he comido mi arroz de siempre» y se añade entera.
      </p>
      <button className="btn ghost sm" onClick={() => { onClose(); ui.open({ k: 'saved' }); }}>
        Ver mis comidas habituales
      </button>
    </Sheet>
  );
}

function emptyRecipe(): Recipe {
  return {
    id: `r-${Date.now().toString(36)}`,
    name: '',
    aliases: [],
    ingredients: [],
    servings: 1,
    prepMinutes: 15,
    tags: [],
    useCount: 0,
    createdAt: Date.now(),
  };
}

function RecipeEditor({ recipe, onClose }: { recipe: Recipe; onClose: () => void }) {
  const app = useApp();
  const ui = useUI();
  const [r, setR] = useState<Recipe>(recipe);
  const [query, setQuery] = useState('');
  const [subFor, setSubFor] = useState<string | null>(null);

  const results = useMemo(
    () => (query.trim().length >= 2 ? searchFoods(query, app.foods, 12) : []),
    [query, app.foods],
  );
  const { total, perServing } = useMemo(() => recipeNutrients(r, app.foodsById), [r, app.foodsById]);

  const setIngredient = (foodId: string, grams: number) =>
    setR((prev) => ({
      ...prev,
      ingredients: prev.ingredients.map((i) => (i.foodId === foodId ? { ...i, grams } : i)),
    }));

  const add = (food: Food) => {
    if (r.ingredients.some((i) => i.foodId === food.id)) return;
    const portion = food.portions.find((p) => p.isDefault) ?? food.portions[0];
    setR((prev) => ({ ...prev, ingredients: [...prev.ingredients, { foodId: food.id, grams: portion?.grams ?? 100 }] }));
    setQuery('');
  };

  const substitutions = useMemo(() => {
    if (!subFor) return [];
    const food = app.foodsById.get(subFor);
    const ing = r.ingredients.find((i) => i.foodId === subFor);
    if (!food || !ing) return [];
    return substitutionsFor(food, ing.grams, app.foods, 6);
  }, [subFor, r.ingredients, app.foodsById, app.foods]);

  return (
    <Sheet
      title={recipe.name ? 'Editar receta' : 'Nueva receta'}
      onClose={onClose}
      footer={
        <div className="btn-row">
          <button className="btn ghost" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={r.name.trim().length < 2 || !r.ingredients.length}
            onClick={async () => {
              await app.actions.upsertRecipe({
                ...r,
                name: r.name.trim(),
                aliases: [...new Set([r.name.trim().toLowerCase(), ...r.aliases])],
              });
              ui.notify('Receta guardada.');
              onClose();
            }}>Guardar</button>
        </div>
      }
    >
      <Field label="Nombre">
        <input className="input" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })}
          placeholder="Arroz de siempre" />
      </Field>
      <div className="grid-2">
        <Field label="Raciones que salen">
          <NumberInput value={r.servings} min={1} onChange={(v) => setR({ ...r, servings: v === '' ? 1 : v })} />
        </Field>
        <Field label="Tiempo de preparación">
          <NumberInput value={r.prepMinutes} step={5} suffix="min"
            onChange={(v) => setR({ ...r, prepMinutes: v === '' ? 0 : v })} />
        </Field>
      </div>

      <div className="card tight">
        <div className="card-title"><span>Ingredientes · {r.ingredients.length}</span></div>
        {r.ingredients.map((ing) => {
          const food = app.foodsById.get(ing.foodId);
          if (!food) return null;
          return (
            <div key={ing.foodId} style={{ borderBottom: '1px solid var(--line)', padding: '9px 0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="row-title" style={{ fontSize: '0.88rem' }}>{food.name}</div>
                  <div className="row-sub">{g(scaleNutrients(food.per100g, ing.grams).kcal)} kcal</div>
                </div>
                <button className="icon-btn" aria-label="Sustituir" onClick={() => setSubFor(subFor === ing.foodId ? null : ing.foodId)}>🔄</button>
                <button className="icon-btn" aria-label="Quitar"
                  onClick={() => setR((prev) => ({ ...prev, ingredients: prev.ingredients.filter((i) => i.foodId !== ing.foodId) }))}>🗑️</button>
              </div>
              <div className="input-row" style={{ marginTop: 6 }}>
                <input className="input" type="number" inputMode="decimal" value={ing.grams} step={5} min={0}
                  aria-label={`Gramos de ${food.name}`}
                  onChange={(e) => setIngredient(ing.foodId, Math.max(0, Number(e.target.value)))} />
                <span className="suffix">{food.unit}</span>
              </div>

              {subFor === ing.foodId && (
                <div style={{ marginTop: 8 }}>
                  <div className="card-title" style={{ marginBottom: 4 }}><span>Sustituciones</span></div>
                  {substitutions.length === 0 && <p className="note" style={{ marginBottom: 0 }}>No hay alternativas equivalentes.</p>}
                  <div className="list">
                    {substitutions.map((s) => (
                      <button className="row" key={s.food.id} onClick={() => {
                        setR((prev) => ({
                          ...prev,
                          ingredients: prev.ingredients.map((i) =>
                            i.foodId === ing.foodId ? { foodId: s.food.id, grams: s.grams } : i,
                          ),
                        }));
                        setSubFor(null);
                      }}>
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
            </div>
          );
        })}

        <input className="input" style={{ marginTop: 10 }} value={query} onChange={(e) => setQuery(e.target.value)}
          placeholder="Añadir ingrediente…" aria-label="Buscar ingrediente" />
        {results.length > 0 && (
          <div className="list" style={{ marginTop: 6 }}>
            {results.map((f) => (
              <button className="row" key={f.id} onClick={() => add(f)}>
                <div className="row-main">
                  <div className="row-title" style={{ fontSize: '0.88rem' }}>{f.name}</div>
                  <div className="row-sub">{g(f.per100g.kcal)} kcal / 100 {f.unit}</div>
                </div>
                <span aria-hidden="true">+</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {r.ingredients.length > 0 && (
        <>
          <div className="card tight">
            <div className="card-title"><span>Por ración ({r.servings} en total)</span></div>
            <MacroPills n={perServing} />
          </div>
          <div className="card tight">
            <div className="card-title"><span>Receta completa</span></div>
            <MacroPills n={total} />
          </div>
        </>
      )}
    </Sheet>
  );
}

// ───────────────────────────── Comidas habituales ─────────────────────────────

export function SavedMealsSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const ui = useUI();
  const [logging, setLogging] = useState<string | null>(null);

  const meal = app.savedMeals.find((m) => m.id === logging);
  if (meal) {
    return (
      <ConfirmEntry
        title={meal.name}
        subtitle="Comida habitual"
        initialItems={meal.items.map((i, idx) => ({ ...i, id: `sm-${idx}-${Date.now().toString(36)}` }))}
        method="saved"
        slot={meal.slotHint}
        onClose={async () => { await app.actions.markSavedMealUsed(meal.id); onClose(); }}
      />
    );
  }

  const sorted = [...app.savedMeals].sort((a, b) => b.useCount - a.useCount || b.createdAt - a.createdAt);

  return (
    <Sheet title="⭐ Mis comidas habituales" onClose={onClose}
      footer={<button className="btn ghost" onClick={() => { onClose(); ui.open({ k: 'recipe' }); }}>Ver recetas</button>}>
      {sorted.length === 0 ? (
        <div className="empty">
          <span className="ico" aria-hidden="true">⭐</span>
          Aún no has guardado ninguna.
          <br />Cuando registres una comida, marca «Guardar como comida habitual».
        </div>
      ) : (
        <div className="list">
          {sorted.map((m) => {
            const n = m.items.reduce<Nutrients>((a, i) => addNutrients(a, i.nutrients), { ...EMPTY_NUTRIENTS });
            return (
              <div className="row" key={m.id}>
                <button className="row-main" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }}
                  onClick={() => setLogging(m.id)}>
                  <div className="row-title">{m.name}</div>
                  <div className="row-sub">
                    {m.items.length} alimentos · usada {m.useCount} {m.useCount === 1 ? 'vez' : 'veces'}
                  </div>
                </button>
                <div className="row-side">
                  {g(n.kcal)} kcal<br />
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>{g(n.protein)} g prot</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
      <p className="note" style={{ marginTop: 12 }}>
        Las que más usas se proponen antes en «¿Qué como ahora?». Así la app se va pareciendo a cómo comes de
        verdad en lugar de a un recetario genérico.
      </p>
    </Sheet>
  );
}
