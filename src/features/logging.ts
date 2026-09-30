import { resolveGrams, scaleNutrients, sumNutrients } from '../domain/nutrition';
import type { ParsedItem } from '../domain/parser';
import { EMPTY_NUTRIENTS, type Food, type LoggedItem, type MealEntry, type Nutrients } from '../domain/types';

/** Contador incremental para ids de items dentro de una misma comida. */
let seq = 0;
function itemId(): string {
  seq += 1;
  return `i-${Date.now().toString(36)}-${seq}`;
}

/** Construye un item de registro a partir de un alimento y una cantidad. */
export function makeItem(
  food: Food,
  quantity: number,
  unit: 'g' | 'ml' | 'portion',
  opts: { portionLabel?: string; confidence?: LoggedItem['confidence'] } = {},
): LoggedItem {
  const grams = resolveGrams(food, quantity, unit, opts.portionLabel);
  return {
    id: itemId(),
    foodId: food.id,
    foodName: food.name,
    quantity,
    unit,
    portionLabel: opts.portionLabel,
    grams,
    confidence: opts.confidence ?? 'exact',
    nutrients: scaleNutrients(food.per100g, grams),
  };
}

/** Recalcula un item cuando el usuario cambia la cantidad en la pantalla de confirmación. */
export function reviseItem(item: LoggedItem, food: Food, grams: number): LoggedItem {
  return {
    ...item,
    quantity: grams,
    unit: food.unit,
    portionLabel: undefined,
    grams,
    // Editar a mano convierte una estimación en un dato que el usuario asume.
    confidence: 'exact',
    nutrients: scaleNutrients(food.per100g, grams),
  };
}

export function itemsFromParsed(parsed: ParsedItem[], foods: Map<string, Food>): LoggedItem[] {
  const out: LoggedItem[] = [];
  for (const p of parsed) {
    const food = foods.get(p.foodId);
    if (!food) continue;
    out.push({
      id: itemId(),
      foodId: food.id,
      foodName: food.name,
      quantity: p.quantity,
      unit: p.unit,
      portionLabel: p.portionLabel,
      grams: p.grams,
      confidence: p.confidence,
      nutrients: scaleNutrients(food.per100g, p.grams),
    });
  }
  return out;
}

export function entryNutrients(entry: Pick<MealEntry, 'items'>): Nutrients {
  return sumNutrients(entry.items.map((i) => i.nutrients));
}

export function itemsNutrients(items: { nutrients: Nutrients }[]): Nutrients {
  return items.length ? sumNutrients(items.map((i) => i.nutrients)) : { ...EMPTY_NUTRIENTS };
}

/** Porcentaje que representa una comida sobre el objetivo del día. */
export function shareOfDay(value: number, target: number): number {
  if (target <= 0) return 0;
  return Math.round((value / target) * 100);
}

export const CONFIDENCE_LABEL: Record<LoggedItem['confidence'], string> = {
  exact: 'exacto',
  estimated: 'estimado',
  rough: 'aproximado',
};

export const CONFIDENCE_TAG: Record<LoggedItem['confidence'], string> = {
  exact: '',
  estimated: 'warn',
  rough: 'warn',
};

/** Alimentos usados hoy: alimentan el criterio de variedad del recomendador. */
export function foodIdsUsed(entries: MealEntry[]): string[] {
  return [...new Set(entries.flatMap((e) => e.items.map((i) => i.foodId)))];
}
