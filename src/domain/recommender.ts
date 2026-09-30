import { BLUEPRINTS, type Blueprint, type BlueprintTag } from '../data/blueprints';
import { addNutrients, roundNutrients, scaleNutrients, volumeToleranceFor } from './nutrition';
import { timeToMinutes } from './dates';
import {
  EMPTY_NUTRIENTS,
  type Food,
  type MealSlot,
  type MealSuggestion,
  type Nutrients,
  type Recipe,
  type SavedMeal,
  type SuggestionContext,
} from './types';

/**
 * Motor de recomendación: responde a "¿qué como ahora?".
 *
 * Dos fases:
 *   1. AJUSTE de cantidades — cada plantilla se estira o encoge para encajar en
 *      los macros que faltan. Una plantilla no es una receta fija.
 *   2. PUNTUACIÓN — se ordenan según el orden de prioridad del usuario:
 *      objetivo → proteína → energía → reparto carbos/grasa → fibra →
 *      entrenamiento → actividad → apetito → digestión → disponibilidad →
 *      preferencias → facilidad → variedad.
 *
 * Nunca propone "una ensalada enorme" cuando falta energía y hay poco apetito:
 * el volumen es un criterio explícito del algoritmo.
 */

// ───────────────────────────── Ajuste de cantidades ─────────────────────────────

/**
 * Redondea a algo que se pueda servir de verdad: los huevos en unidades, las
 * lonchas en lonchas, el arroz en múltiplos de 5 g.
 *
 * `max` es obligatorio respetarlo DESPUÉS de redondear. Sin eso, redondear al
 * alza una unidad discreta se saltaba el tope de la plantilla: 180 g de pechuga
 * (tope) se convertían en 2 filetes de 100 g = 200 g.
 */
function roundGrams(food: Food, grams: number, max?: number): number {
  const unitPortion = food.portions.find((p) => p.isDefault) ?? food.portions[0];
  const discrete = /unidad|loncha|filete|bola|onza|cacito|rebanada|lata|tarrina|clara/.test(
    (unitPortion?.label ?? '').toLowerCase(),
  );
  if (discrete && unitPortion) {
    let units = Math.max(0, Math.round(grams / unitPortion.grams));
    if (max != null) {
      // Se baja a la última unidad completa que cabe dentro del tope.
      while (units > 1 && units * unitPortion.grams > max) units--;
    }
    return units * unitPortion.grams;
  }
  const rounded = grams < 30 ? Math.round(grams) : Math.round(grams / 5) * 5;
  return max != null ? Math.min(rounded, Math.round(max)) : rounded;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

interface FittedItem {
  foodId: string;
  foodName: string;
  grams: number;
  unit: 'g' | 'ml';
}

interface Fitted {
  items: FittedItem[];
  nutrients: Nutrients;
  /**
   * true si se ha omitido algún componente de la plantilla (porque no estaba
   * disponible o estaba restringido). En ese caso el título de la plantilla ya
   * no describe la comida y hay que rehacerlo: anunciar "con carne picada" una
   * comida que no la lleva es exactamente el tipo de mentira que hay que evitar.
   */
  dropped: boolean;
}

/** Nombre corto y legible de un alimento, sin el estado entre paréntesis. */
function shortName(food: Food): string {
  return food.name.replace(/\([^)]*\)/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
}

/**
 * Título construido a partir de los alimentos que realmente lleva la comida,
 * con el orden habitual en español: primero el carbohidrato, luego la proteína.
 */
function titleFromItems(items: FittedItem[], foods: Map<string, Food>): string {
  const relevant = items
    .map((i) => ({ item: i, food: foods.get(i.foodId) }))
    .filter((x): x is { item: FittedItem; food: Food } => !!x.food)
    .filter((x) => !isPantryStaple(x.food.id) && x.item.grams >= 20)
    .sort((a, b) => {
      const rank = (c: string) => (c === 'carb' ? 0 : c === 'protein' || c === 'dairy' ? 1 : 2);
      const d = rank(a.food.category) - rank(b.food.category);
      if (d !== 0) return d;
      return b.item.grams - a.item.grams;
    });
  const names = relevant.slice(0, 3).map((x) => shortName(x.food));
  if (!names.length) return 'Comida a medida';
  const title = names.length === 1 ? names[0] : `${names[0]} con ${names.slice(1).join(' y ')}`;
  return title.charAt(0).toUpperCase() + title.slice(1);
}

/** Gramos necesarios de `food` para aportar `need` gramos del nutriente `key`. */
function gramsFor(food: Food, key: 'protein' | 'carbs' | 'fat', need: number): number {
  const per = food.per100g[key] / 100;
  if (per <= 0.001) return 0;
  return need / per;
}

function fitBlueprint(
  bp: Blueprint,
  ctx: SuggestionContext,
  foods: Map<string, Food>,
  /** Si se pasa, solo se usan estos alimentos (modo "tengo esto en casa"). */
  available: Set<string> | null,
): Fitted | null {
  const items: FittedItem[] = [];
  let total: Nutrients = { ...EMPTY_NUTRIENTS };

  /** Un componente se puede usar si existe y, en su caso, está disponible. */
  const get = (id: string | undefined): Food | null => {
    if (!id) return null;
    const f = foods.get(id);
    if (!f) return null;
    if (available && !available.has(id) && !isPantryStaple(id)) return null;
    if (ctx.dislikes.includes(id)) return null;
    if (isRestricted(f, ctx.restrictions)) return null;
    return f;
  };

  let dropped = false;
  const push = (food: Food, grams: number, max?: number) => {
    if (grams <= 0) return;
    const g = roundGrams(food, grams, max);
    if (g <= 0) return;
    items.push({ foodId: food.id, foodName: food.name, grams: g, unit: food.unit });
    total = addNutrients(total, scaleNutrients(food.per100g, g));
  };

  // 1. Elementos de cantidad fija: definen el suelo de la comida.
  //    Son opcionales: si falta el tomate, la comida sigue siendo válida.
  for (const extra of bp.extras ?? []) {
    const f = get(extra.foodId);
    if (f) push(f, extra.grams);
    else dropped = true;
  }
  if (bp.protein2) {
    const f = get(bp.protein2.foodId);
    if (f) push(f, bp.protein2.grams);
    else dropped = true;
  }
  if (bp.veg) {
    const f = get(bp.veg.foodId);
    if (!f) dropped = true;
    if (f) {
    // Con poco apetito se recorta la verdura: ocupa sitio sin aportar energía.
    const tolerance = volumeToleranceFor(ctx.hunger);
      const factor = tolerance === 'low' ? 0.4 : tolerance === 'medium' ? 0.7 : 1;
      push(f, bp.veg.grams * factor);
    }
  }

  // 2. Proteína principal: se dimensiona para cubrir lo que falta.
  //    Esta sí es obligatoria: sin ella la comida no cumple su función.
  if (bp.protein) {
    const f = get(bp.protein.foodId);
    if (!f) {
      dropped = true;
      // Salvo que otra fuente proteica de la propia plantilla ya esté cubriendo.
      if (total.protein < 12) return null;
    } else {
      const need = Math.max(0, ctx.remaining.protein - total.protein);
      const want = gramsFor(f, 'protein', need);
      push(f, clamp(want, bp.protein.min, bp.protein.max), bp.protein.max);
    }
  }

  // 3. Carbohidrato: absorbe la energía que queda. Opcional.
  if (bp.carb) {
    const f = get(bp.carb.foodId);
    if (!f) dropped = true;
    if (f) {
    const needCarbs = Math.max(0, ctx.remaining.carbs - total.carbs);
    const byCarbs = gramsFor(f, 'carbs', needCarbs);
    // También se mira la energía: si la energía restante es poca, manda ella.
    const kcalLeft = Math.max(0, ctx.remaining.kcal - total.kcal);
    const byKcal = f.per100g.kcal > 0 ? (kcalLeft / f.per100g.kcal) * 100 : 0;
      push(f, clamp(Math.min(byCarbs, byKcal), bp.carb.min, bp.carb.max), bp.carb.max);
    }
  }

  // 4. Grasa: ajuste fino, el último en repartirse. Opcional.
  if (bp.fat) {
    const f = get(bp.fat.foodId);
    if (!f) dropped = true;
    if (f) {
      const need = Math.max(0, ctx.remaining.fat - total.fat);
      push(f, clamp(gramsFor(f, 'fat', need), bp.fat.min, bp.fat.max), bp.fat.max);
    }
  }

  if (!items.length) return null;
  return { items, nutrients: roundNutrients(total), dropped };
}

// ───────────────────────────── Puntuación ─────────────────────────────

/** 1 cuando el aporte encaja con lo que falta, 0 cuando se desvía mucho. */
function fitScore(got: number, need: number, tolerance: number): number {
  if (need <= 0) {
    // No falta nada de este macro: pasarse resta, pero suavemente.
    return got <= tolerance ? 1 : Math.max(0, 1 - (got - tolerance) / (tolerance * 3 || 1));
  }
  const diff = Math.abs(got - need);
  return Math.max(0, 1 - diff / Math.max(need, tolerance));
}

/** Etiquetas que designan una franja del día. */
const MEAL_TAGS = new Set<BlueprintTag>(['breakfast', 'lunch', 'snack', 'dinner']);

const SLOT_TAG: Record<MealSlot, BlueprintTag | null> = {
  breakfast: 'breakfast',
  lunch: 'lunch',
  snack: 'snack',
  dinner: 'dinner',
  extra: null,
};

interface ScoreResult {
  score: number;
  why: string[];
}

function scoreCandidate(
  cand: { tags: BlueprintTag[]; prepMinutes: number; nutrients: Nutrients; items: FittedItem[] },
  ctx: SuggestionContext,
  foods: Map<string, Food>,
  recentFoodIds: Set<string>,
): ScoreResult {
  const n = cand.nutrients;
  const r = ctx.remaining;
  const why: string[] = [];
  let score = 0;

  // (1-2) Proteína restante: el criterio de más peso en una fase de ganancia.
  const proteinFit = fitScore(n.protein, r.protein, 15);
  score += proteinFit * 34;
  if (r.protein > 10 && n.protein >= r.protein * 0.7) {
    why.push(`Aporta ${Math.round(n.protein)} g de proteína, y te faltaban unos ${Math.round(r.protein)} g.`);
  }

  // (3) Energía restante.
  const kcalFit = fitScore(n.kcal, r.kcal, 200);
  score += kcalFit * 24;
  if (r.kcal > 150 && n.kcal >= r.kcal * 0.6 && n.kcal <= r.kcal * 1.25) {
    why.push(`Unas ${Math.round(n.kcal)} kcal, en línea con las ~${Math.round(r.kcal)} que te quedan.`);
  }

  // (4) Reparto de carbohidratos y grasa.
  score += fitScore(n.carbs, r.carbs, 40) * 12;
  score += fitScore(n.fat, r.fat, 15) * 8;
  if (r.fat <= 5 && n.fat <= 15) {
    why.push('Es baja en grasa, porque hoy ya tienes la grasa prácticamente cubierta.');
  }
  if (r.carbs > 60 && n.carbs >= 50) {
    why.push(`Carga ${Math.round(n.carbs)} g de carbohidratos, que es lo que más te falta.`);
  }

  // (5) Fibra: suma, pero nunca a costa de la comodidad digestiva.
  if (r.fiber > 3) score += Math.min(1, n.fiber / Math.max(r.fiber, 5)) * 5;

  // (6) Entrenamiento: en día de entreno, prioridad a carbohidrato y recuperación.
  if (ctx.trained) {
    if (cand.tags.includes('postWorkout')) {
      score += 5;
      why.push('Encaja bien después de entrenar: proteína y carbohidrato juntos.');
    }
    if (n.carbs >= 45) score += 3;
  }

  // (7) Momento del día. Una plantilla pensada para desayunar no es una cena:
  // si declara franjas y ninguna es la actual, se penaliza de verdad. Antes solo
  // se dejaba de bonificar, y el resultado era proponer dátiles con crema de
  // cacahuete como cena después de entrenar.
  const slotTag = SLOT_TAG[ctx.slot];
  const declaredSlots = cand.tags.filter((t) => MEAL_TAGS.has(t));
  if (declaredSlots.length) {
    if (slotTag && declaredSlots.includes(slotTag)) score += 8;
    else score -= 22;
  }
  const hour = timeToMinutes(ctx.now);
  if (hour >= 21 * 60 && cand.prepMinutes > 20) {
    score -= 6;
    // Entrenar tarde y cocinar media hora después no ocurre. Realismo.
  }

  // (8) Apetito: con poco apetito manda la densidad, no el volumen.
  const tolerance = volumeToleranceFor(ctx.hunger);
  const bulky = cand.items.filter((i) => foods.get(i.foodId)?.volumeIndex === 'high');
  const bulkyGrams = bulky.reduce((a, i) => a + i.grams, 0);
  if (tolerance === 'low') {
    if (cand.tags.includes('lowVolume')) {
      score += 10;
      why.push('Es pequeña y densa: hoy has dicho que tienes poco apetito.');
    }
    score -= Math.min(12, bulkyGrams / 40);
    // Densidad energética: kcal por gramo de comida.
    const grams = cand.items.reduce((a, i) => a + i.grams, 0);
    const density = grams > 0 ? n.kcal / grams : 0;
    score += Math.min(8, density * 4);
  } else if (tolerance === 'medium' && cand.tags.includes('lowVolume')) {
    score += 4;
  } else if (ctx.hunger === 'high' && bulkyGrams > 150) {
    score += 2;
  }

  // (9) Digestión: si hay hinchazón, se evita lo muy fermentable y la fibra alta.
  if (ctx.digestion === 'bloated' || ctx.digestion === 'bad') {
    const fermentable = cand.items.filter((i) => foods.get(i.foodId)?.fermentability === 'high');
    if (fermentable.length) {
      score -= fermentable.length * 6;
    } else if (cand.tags.includes('lowFiber') || n.fiber <= 6) {
      score += 7;
      why.push('Es fácil de digerir, porque hoy te has notado hinchado.');
    }
    if (n.fiber > 12) score -= 5;
  }

  // (12) Facilidad de preparación.
  score += Math.max(0, 8 - cand.prepMinutes / 3);
  if (ctx.mode === 'quick' || ctx.mode === 'noCook') {
    if (cand.prepMinutes <= 5) score += 6;
  }

  // (13) Variedad: lo comido hoy pierde puntos, para no repetir lo mismo.
  const repeated = cand.items.filter((i) => recentFoodIds.has(i.foodId)).length;
  score -= repeated * 2.5;

  return { score, why };
}

// ───────────────────────────── Candidatos guardados ─────────────────────────────

function tagsForSaved(prepMinutes: number, nutrients: Nutrients, slotHint?: MealSlot): BlueprintTag[] {
  const tags: BlueprintTag[] = [];
  if (prepMinutes <= 6) tags.push('quick');
  if (prepMinutes <= 3) tags.push('noCook');
  if (nutrients.protein >= 30) tags.push('highProtein');
  if (nutrients.fiber <= 6) tags.push('lowFiber');
  if (slotHint) {
    const t = SLOT_TAG[slotHint];
    if (t) tags.push(t);
  }
  return tags;
}

/** Escala una comida guardada o receta para encajar en los macros que faltan. */
function scaleFactorFor(nutrients: Nutrients, ctx: SuggestionContext): number {
  const byProtein = nutrients.protein > 0 ? ctx.remaining.protein / nutrients.protein : Infinity;
  const byKcal = nutrients.kcal > 0 ? ctx.remaining.kcal / nutrients.kcal : Infinity;
  const raw = Math.min(byProtein, byKcal);
  if (!isFinite(raw) || raw <= 0) return 1;
  // Solo se permiten ajustes razonables: media ración a ración y media.
  return clamp(Math.round(raw * 4) / 4, 0.5, 1.5);
}

// ───────────────────────────── API pública ─────────────────────────────

export interface RecommendInput {
  ctx: SuggestionContext;
  foods: Map<string, Food>;
  savedMeals?: SavedMeal[];
  recipes?: Recipe[];
  /** Alimentos ya consumidos hoy: alimentan el criterio de variedad. */
  recentFoodIds?: string[];
  limit?: number;
}

export function recommendMeals(input: RecommendInput): MealSuggestion[] {
  const { ctx, foods } = input;
  const recent = new Set(input.recentFoodIds ?? []);
  const dislikes = new Set(ctx.dislikes);
  const available = ctx.availableFoodIds?.length ? new Set(ctx.availableFoodIds) : null;
  const maxPrep =
    ctx.maxPrepMinutes ?? (ctx.mode === 'noCook' ? 5 : ctx.mode === 'quick' ? 12 : 40);

  const candidates: MealSuggestion[] = [];

  // ─── Plantillas ───
  for (const bp of BLUEPRINTS) {
    if (bp.prepMinutes > maxPrep) continue;
    if (ctx.mode === 'noCook' && !bp.tags.includes('noCook')) continue;

    // (10) Disponibilidad y (11) preferencias se aplican al ajustar: los
    // componentes que no hay se omiten y la comida se rehace sin ellos, en vez
    // de descartarla entera. Es lo que pide el modo "tengo esto en casa".
    const fitted = fitBlueprint(bp, ctx, foods, available);
    if (!fitted) continue;
    // Una propuesta que no aporta nada no es una propuesta.
    if (fitted.nutrients.kcal < 120) continue;
    // Y una comida sin proteína apreciable tampoco sirve para este objetivo.
    if (fitted.nutrients.protein < 10) continue;
    // "Atún" a secas no es una comida. Al descartar componentes que no hay en
    // casa, las plantillas degeneraban en un solo alimento: se exige que queden
    // al menos dos ingredientes reales (el aceite y el café no cuentan).
    if (fitted.items.filter((i) => !isPantryStaple(i.foodId)).length < 2) continue;

    const { score, why } = scoreCandidate(
      { tags: bp.tags, prepMinutes: bp.prepMinutes, nutrients: fitted.nutrients, items: fitted.items },
      ctx,
      foods,
      recent,
    );

    candidates.push({
      id: bp.id,
      // Si se ha omitido algo, el título se rehace con lo que sí lleva.
      title: fitted.dropped ? titleFromItems(fitted.items, foods) : bp.title,
      items: fitted.items,
      nutrients: fitted.nutrients,
      prepMinutes: bp.prepMinutes,
      why,
      score,
    });
  }

  // ─── Comidas guardadas del usuario: lo que ya sabemos que come ───
  for (const meal of input.savedMeals ?? []) {
    if (meal.prepMinutes > maxPrep) continue;
    const baseNutrients = meal.items.reduce<Nutrients>((a, i) => addNutrients(a, i.nutrients), {
      ...EMPTY_NUTRIENTS,
    });
    if (baseNutrients.kcal <= 0) continue;
    const factor = scaleFactorFor(baseNutrients, ctx);
    const items = meal.items.map((i) => ({
      foodId: i.foodId,
      foodName: i.foodName,
      grams: Math.round(i.grams * factor),
      unit: (foods.get(i.foodId)?.unit ?? 'g') as 'g' | 'ml',
    }));
    if (items.some((i) => dislikes.has(i.foodId))) continue;
    if (available && !items.every((i) => available.has(i.foodId) || isPantryStaple(i.foodId))) continue;
    const nutrients = roundNutrients(scaleNutrientsTotal(baseNutrients, factor));

    const { score, why } = scoreCandidate(
      {
        tags: tagsForSaved(meal.prepMinutes, nutrients, meal.slotHint),
        prepMinutes: meal.prepMinutes,
        nutrients,
        items,
      },
      ctx,
      foods,
      recent,
    );

    candidates.push({
      id: `saved-${meal.id}`,
      title: factor === 1 ? meal.name : `${meal.name} (${formatFactor(factor)})`,
      items,
      nutrients,
      prepMinutes: meal.prepMinutes,
      // Familiaridad: lo que ya comes habitualmente se propone antes.
      why: [`Es una de tus comidas habituales (la has registrado ${meal.useCount} ${meal.useCount === 1 ? 'vez' : 'veces'}).`, ...why],
      score: score + 8 + Math.min(8, meal.useCount),
      savedMealId: meal.id,
    });
  }

  // ─── Recetas ───
  for (const recipe of input.recipes ?? []) {
    if (recipe.prepMinutes > maxPrep) continue;
    const perServing = recipe.ingredients.reduce<Nutrients>((a, ing) => {
      const f = foods.get(ing.foodId);
      if (!f) return a;
      return addNutrients(a, scaleNutrients(f.per100g, ing.grams / recipe.servings));
    }, { ...EMPTY_NUTRIENTS });
    if (perServing.kcal <= 0) continue;
    const factor = scaleFactorFor(perServing, ctx);
    const items = recipe.ingredients
      .map((ing) => {
        const f = foods.get(ing.foodId);
        if (!f) return null;
        return {
          foodId: f.id,
          foodName: f.name,
          grams: Math.round((ing.grams / recipe.servings) * factor),
          unit: f.unit,
        };
      })
      .filter(Boolean) as FittedItem[];
    if (!items.length) continue;
    if (items.some((i) => dislikes.has(i.foodId))) continue;
    if (available && !items.every((i) => available.has(i.foodId) || isPantryStaple(i.foodId))) continue;
    const nutrients = roundNutrients(scaleNutrientsTotal(perServing, factor));

    const { score, why } = scoreCandidate(
      { tags: tagsForSaved(recipe.prepMinutes, nutrients), prepMinutes: recipe.prepMinutes, nutrients, items },
      ctx,
      foods,
      recent,
    );

    candidates.push({
      id: `recipe-${recipe.id}`,
      title: factor === 1 ? recipe.name : `${recipe.name} (${formatFactor(factor)})`,
      items,
      nutrients,
      prepMinutes: recipe.prepMinutes,
      why: [`Es tu receta guardada "${recipe.name}".`, ...why],
      score: score + 6 + Math.min(8, recipe.useCount),
      recipeId: recipe.id,
    });
  }

  // Se evita proponer dos veces lo mismo con distinto envoltorio. La comparación
  // es por CONJUNTO de alimentos: dos plantillas distintas que, tras descartar
  // lo que no hay en casa, se quedan en los mismos ingredientes son la misma
  // comida, y enseñarlas como dos opciones es engañar al usuario.
  const sorted = candidates.sort((a, b) => b.score - a.score);
  const out: MealSuggestion[] = [];
  const seen: Set<string>[] = [];
  for (const c of sorted) {
    const key = new Set(c.items.filter((i) => !isPantryStaple(i.foodId)).map((i) => i.foodId));
    const clash =
      out.some((o) => o.title === c.title) ||
      seen.some((prev) => isSubsetOrEqual(key, prev) || isSubsetOrEqual(prev, key));
    if (!clash) {
      out.push(c);
      seen.push(key);
    }
    if (out.length >= (input.limit ?? 3)) break;
  }
  return out;
}

/** true si `a` está contenido en `b` (o son iguales). */
function isSubsetOrEqual(a: Set<string>, b: Set<string>): boolean {
  if (a.size > b.size) return false;
  for (const id of a) if (!b.has(id)) return false;
  return true;
}

function scaleNutrientsTotal(n: Nutrients, factor: number): Nutrients {
  return {
    kcal: n.kcal * factor,
    protein: n.protein * factor,
    carbs: n.carbs * factor,
    fat: n.fat * factor,
    fiber: n.fiber * factor,
    satFat: (n.satFat ?? 0) * factor,
    sugars: (n.sugars ?? 0) * factor,
    sodium: (n.sodium ?? 0) * factor,
  };
}

function formatFactor(f: number): string {
  if (f < 1) return `${f === 0.5 ? 'media' : `${f}`} ración`;
  return `${f} raciones`;
}

/** Condimentos y básicos que se dan por supuestos en la despensa. */
const PANTRY_STAPLES = new Set(['aceite-oliva', 'sal', 'cafe', 'te', 'azucar', 'miel', 'salsa-soja', 'ketchup']);
function isPantryStaple(id: string): boolean {
  return PANTRY_STAPLES.has(id);
}

/** Restricciones expresadas en lenguaje natural ("sin lactosa", "sin cerdo"). */
export function isRestricted(food: Food | undefined, restrictions: string[]): boolean {
  if (!food || !restrictions.length) return false;
  const hay = `${food.name} ${food.category} ${food.proteinSource}`.toLowerCase();
  for (const raw of restrictions) {
    const r = raw.toLowerCase().trim();
    if (!r) continue;
    if (r.includes('lactosa') || r.includes('lacteo') || r.includes('lácteo')) {
      if (food.proteinSource === 'dairy' || food.category === 'dairy') {
        // La bebida de soja no es un lácteo aunque esté en esa categoría.
        if (food.proteinSource !== 'soy') return true;
      }
    }
    if ((r.includes('cerdo') || r.includes('porcino')) && /cerdo|jamon|jamón|serrano/.test(hay)) return true;
    if (r.includes('gluten') && /pan|pasta|tortilla de trigo|cereales|avena|cuscus|cuscús|muesli/.test(hay)) return true;
    if (r.includes('pescado') && food.proteinSource === 'fish') return true;
    if ((r.includes('vegetarian') || r.includes('vegan')) && ['poultry', 'redMeat', 'fish'].includes(food.proteinSource)) return true;
    if (r.includes('vegan') && ['dairy', 'egg'].includes(food.proteinSource)) return true;
    if (r.includes('huevo') && food.proteinSource === 'egg') return true;
    if (r.includes('frutos secos') && /almendra|nuez|nueces|cacahuete|pipas/.test(hay)) return true;
  }
  return false;
}

// ───────────────────────────── Sustituciones ─────────────────────────────

export interface Substitution {
  food: Food;
  grams: number;
  /** Diferencia respecto al original, en % de kcal y de proteína. */
  kcalDelta: number;
  proteinDelta: number;
  note: string;
}

/**
 * Propone alternativas para un alimento manteniendo aproximadamente su aporte
 * proteico, y ajustando los gramos para que cuadre.
 */
export function substitutionsFor(
  original: Food,
  grams: number,
  foods: Food[],
  limit = 5,
): Substitution[] {
  const target = scaleNutrients(original.per100g, grams);
  const anchor: 'protein' | 'carbs' | 'fat' =
    original.category === 'protein' || original.proteinSource !== 'none'
      ? 'protein'
      : original.category === 'carb'
        ? 'carbs'
        : 'fat';
  const targetAmount = target[anchor];
  if (targetAmount <= 0) return [];

  const out: Substitution[] = [];
  for (const f of foods) {
    if (f.id === original.id || f.id === original.counterpartId) continue;
    // Los condimentos y las bebidas nunca son sustitutos, aunque la aritmética
    // cuadre: 405 g de salsa de soja "aportan la proteína de 100 g de pollo",
    // y proponerlo sería absurdo.
    if (f.category === 'other' || f.category === 'drink') continue;
    // Solo se sustituye dentro del mismo papel nutricional.
    if (anchor === 'protein') {
      if (f.proteinSource === 'none') continue;
      // Densidad proteica mínima: por debajo de 10 g/100 g haría falta una
      // cantidad que nadie se come de una sentada.
      if (f.per100g.protein < 10) continue;
      if (!['protein', 'dairy'].includes(f.category)) continue;
    } else if (f.category !== original.category) {
      continue;
    }
    const per = f.per100g[anchor] / 100;
    if (per <= 0.02) continue;
    const g = roundGrams(f, targetAmount / per);
    // La ración tiene que ser comible: ni más de 400 g, ni el triple de la
    // cantidad original.
    if (g <= 0 || g > 400 || g > grams * 3) continue;
    const n = scaleNutrients(f.per100g, g);
    const kcalDelta = target.kcal > 0 ? (n.kcal - target.kcal) / target.kcal : 0;
    // Se descartan los cambios que alteran la energía más de un 45%.
    if (Math.abs(kcalDelta) > 0.45) continue;
    out.push({
      food: f,
      grams: g,
      kcalDelta,
      proteinDelta: target.protein > 0 ? (n.protein - target.protein) / target.protein : 0,
      note: `${g} g de ${f.name.toLowerCase()} aportan una proteína parecida (${Math.round(n.protein)} g frente a ${Math.round(target.protein)} g) y ${kcalDelta >= 0 ? '+' : ''}${Math.round(kcalDelta * 100)}% de energía.`,
    });
  }
  return out.sort((a, b) => Math.abs(a.kcalDelta) - Math.abs(b.kcalDelta)).slice(0, limit);
}
