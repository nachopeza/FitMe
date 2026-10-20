import { COMPOSITIONS, type Composition } from '../data/compositions';
import { timeToMinutes } from '../domain/dates';
import type { MealSlot, SavedMeal } from '../domain/types';
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
  kind: 'saved' | 'composition';
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

export interface QuickAddInput {
  savedMeals: SavedMeal[];
  /** Macros ya calculados de cada comida guardada. */
  macrosOf: (meal: SavedMeal) => { kcal: number; protein: number };
  /** Franja actual, para empujar lo que encaja. */
  slot: MealSlot;
  limit?: number;
  /** Composiciones a ofrecer. Inyectable para poder probarlo. */
  compositions?: Composition[];
}

export function quickAddItems(input: QuickAddInput): QuickItem[] {
  const { savedMeals, macrosOf, slot } = input;
  const compositions = input.compositions ?? COMPOSITIONS;
  const limit = input.limit ?? 6;

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
    score: (COMPOSITION_SLOT[comp.id] === slot ? 60 : 30),
  }));

  // Si ya hay una comida guardada que sale de una composición, la composición
  // baja: lo que interesa arriba es su café concreto, no el constructor.
  const savedNames = new Set(saved.map((s) => s.name.toLowerCase()));
  for (const c of comps) {
    if ([...savedNames].some((n) => n.startsWith(c.name.toLowerCase()))) c.score -= 25;
  }

  return [...saved, ...comps]
    .sort((a, b) => b.score - a.score || b.useCount - a.useCount)
    .slice(0, limit)
    .map(({ score: _score, ...item }) => item);
}

/** Icono por el contenido de la comida, para no dejarlas todas iguales. */
function iconForSaved(meal: SavedMeal): IconName {
  const text = `${meal.name} ${meal.items.map((i) => i.foodName).join(' ')}`.toLowerCase();
  if (/caf[eé]|cortado|americano/.test(text)) return 'coffee';
  if (/batido|prote[ií]na|whey|cacito/.test(text)) return 'shake';
  if (/tostada|pan|bocadillo|sandwich|fajita|tortilla de trigo/.test(text)) return 'bread';
  if (/yogur|queso batido|requesón|requeson|cereales|muesli/.test(text)) return 'bowl';
  return 'plate';
}
