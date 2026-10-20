import { COMPOSITIONS, type Composition } from '../data/compositions';
import { timeToMinutes } from '../domain/dates';
import { dominantMacro } from '../domain/motivation';
import type { MealSlot, Nutrients, SavedMeal } from '../domain/types';
import type { IconName } from '../ui/icons';

/**
 * Qué se ofrece para añadir de un toque.
 *
 * Es la respuesta al problema de fondo: registrar da pereza. Si abrir la app y
 * apuntar el café cuesta cinco toques y una búsqueda, no se apunta; y si no se
 * apunta, el usuario no ve que se está quedando corto de comida, que es
 * justamente lo que le pasa.
 *
 * El orden lo marca lo que come DE VERDAD —sus comidas guardadas, por número de
 * usos— y después los básicos componibles. La hora del día empuja hacia arriba
 * lo que encaja con la franja.
 */

export interface QuickItem {
  key: string;
  kind: 'saved' | 'composition' | 'basic';
  /** Id de la comida guardada o de la composición. */
  id: string;
  name: string;
  icon: IconName;
  kcal: number;
  protein: number;
  /** Veces usada: alimenta el orden y se muestra si es alto. */
  useCount: number;
  /** true cuando basta un toque para registrarla tal cual. */
  instant: boolean;
  /** Qué decir bajo el nombre cuando todavía no hay macros que enseñar. */
  note?: string;
  /** Macro que domina el aporte, para teñir la casilla. null = repartido. */
  macro: 'protein' | 'carbs' | 'fat' | null;
}

const COMPOSITION_SLOT: Record<string, MealSlot | undefined> = Object.fromEntries(
  COMPOSITIONS.map((c) => [c.id, c.slotHint]),
);

/** Franja aproximada a partir de la hora, sin depender del perfil. */
export function slotFromHour(time: string): MealSlot {
  const m = timeToMinutes(time);
  if (m < 11 * 60 + 30) return 'breakfast';
  if (m < 16 * 60) return 'lunch';
  if (m < 19 * 60 + 30) return 'snack';
  return 'dinner';
}

/** Un básico suyo, ya resuelto a una ración concreta. */
export interface BasicFood {
  id: string;
  name: string;
  icon: IconName;
  portionLabel: string;
  nutrients: Nutrients;
  useCount: number;
}

export interface QuickAddInput {
  savedMeals: SavedMeal[];
  /** Macros ya calculados de cada comida guardada. */
  macrosOf: (meal: SavedMeal) => Nutrients;
  /** Franja actual, para empujar lo que encaja. */
  slot: MealSlot;
  limit?: number;
  /** Composiciones a ofrecer. Inyectable para poder probarlo. */
  compositions?: Composition[];
  /** Sus básicos elegidos a mano, con la ración por defecto ya resuelta. */
  basics?: BasicFood[];
}

export function quickAddItems(input: QuickAddInput): QuickItem[] {
  const { savedMeals, macrosOf, slot } = input;
  const compositions = input.compositions ?? COMPOSITIONS;
  const basicFoods = input.basics ?? [];
  const limit = input.limit ?? 6;

  // Los básicos que él ha elegido van por delante de los componibles: son suyos.
  const basics: (QuickItem & { score: number })[] = basicFoods.map((b) => ({
    key: `basic-${b.id}`,
    kind: 'basic',
    id: b.id,
    name: b.name,
    icon: b.icon,
    kcal: b.nutrients.kcal,
    protein: b.nutrients.protein,
    useCount: b.useCount,
    instant: true,
    note: b.portionLabel,
    macro: dominantMacro(b.nutrients),
    score: 80 + Math.min(30, b.useCount * 3),
  }));

  const saved: (QuickItem & { score: number })[] = savedMeals.map((meal) => {
    const n = macrosOf(meal);
    // Lo muy usado pesa, pero con rendimientos decrecientes: que algo se haya
    // registrado cuarenta veces no debe tapar todo lo demás para siempre.
    let score = 100 + Math.min(40, meal.useCount * 4);
    if (meal.slotHint === slot) score += 25;
    // Lo usado hace poco sube: refleja la racha actual, no el histórico entero.
    if (meal.lastUsedAt && Date.now() - meal.lastUsedAt < 1000 * 60 * 60 * 72) score += 12;
    return {
      key: `saved-${meal.id}`,
      kind: 'saved',
      id: meal.id,
      name: meal.name,
      icon: iconForSaved(meal),
      kcal: n.kcal,
      protein: n.protein,
      useCount: meal.useCount,
      instant: true,
      macro: dominantMacro(n),
      score,
    };
  });

  const comps: (QuickItem & { score: number })[] = compositions.map((comp) => ({
    key: `comp-${comp.id}`,
    kind: 'composition',
    id: comp.id,
    name: comp.name,
    icon: comp.icon,
    kcal: 0,
    protein: 0,
    useCount: 0,
    // Una composición hay que concretarla: abre el constructor.
    instant: false,
    note: comp.tagline,
    // Una composición todavía no tiene macros, pero sí se sabe de qué va.
    macro: comp.macro ?? null,
    score: (COMPOSITION_SLOT[comp.id] === slot ? 60 : 30),
  }));

  // Si ya hay una comida guardada que sale de una composición, la composición
  // baja: lo que interesa arriba es su café concreto, no el constructor.
  const savedNames = new Set(saved.map((s) => s.name.toLowerCase()));
  for (const c of comps) {
    if ([...savedNames].some((n) => n.startsWith(c.name.toLowerCase()))) c.score -= 25;
  }

  return [...saved, ...basics, ...comps]
    .sort((a, b) => b.score - a.score || b.useCount - a.useCount)
    .slice(0, limit)
    .map(({ score: _score, ...item }) => item);
}

/** Icono por el contenido de la comida, para no dejarlas todas iguales. */
function iconForSaved(meal: SavedMeal): IconName {
  return iconForText(`${meal.name} ${meal.items.map((i) => i.foodName).join(' ')}`);
}

/** Icono a partir del nombre. Compartido por comidas guardadas y básicos. */
export function iconForText(text: string): IconName {
  const t = text.toLowerCase();
  if (/caf[eé]|cortado|americano/.test(t)) return 'coffee';
  if (/batido|prote[ií]na|whey|cacito/.test(t)) return 'shake';
  if (/tostada|pan|bocadillo|sandwich|fajita|tortilla de trigo/.test(t)) return 'bread';
  if (/yogur|queso batido|requesón|requeson|cereales|muesli/.test(t)) return 'bowl';
  return 'plate';
}
