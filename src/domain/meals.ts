import type { MealSlot, Nutrients } from './types';

/**
 * Reparto del día entre comidas.
 *
 * Sin un objetivo por franja, "te faltan 2000 kcal" a mediodía no dice nada
 * accionable. Con él, "en el desayuno te has quedado en 320 de 600" sí: señala
 * dónde se está quedando corto, que es exactamente su problema.
 *
 * La proteína se reparte a partes iguales entre las comidas principales en vez
 * de en proporción a las calorías: para hipertrofia importa que haya varias
 * dosis suficientes repartidas, no que la cena lleve el triple que el desayuno.
 */

/** Peso de cada franja sobre la energía del día. */
const SHARE: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch: 0.32,
  snack: 0.15,
  dinner: 0.28,
  // "Extra" no reserva nada: es el cajón de lo que no encaja en ninguna comida.
  extra: 0,
};

/** Las franjas que son una comida de verdad, con su dosis de proteína. */
const MAIN: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner'];

export interface MealTarget {
  slot: MealSlot;
  kcal: number;
  protein: number;
}

/**
 * Objetivo de cada comida.
 *
 * `slots` son las franjas que esa persona usa de verdad; si falta alguna, su
 * parte se reparte entre las demás en lugar de perderse.
 */
export function mealTargets(
  dailyKcal: number,
  dailyProtein: number,
  slots: MealSlot[] = MAIN,
): MealTarget[] {
  const used = MAIN.filter((s) => slots.includes(s));
  if (!used.length) return [];

  const totalShare = used.reduce((a, s) => a + SHARE[s], 0);
  // Por si llega una combinación cuyos pesos no suman 1: se normaliza.
  const perProtein = dailyProtein / used.length;

  return used.map((slot) => ({
    slot,
    kcal: Math.round((dailyKcal * SHARE[slot]) / totalShare),
    protein: Math.round(perProtein),
  }));
}

/** Lo comido en cada franja, a partir de las entradas ya agrupadas. */
export function eatenBySlot(
  entries: { slot: MealSlot; nutrients: Nutrients }[],
): Map<MealSlot, Nutrients> {
  const map = new Map<MealSlot, Nutrients>();
  for (const e of entries) {
    const prev = map.get(e.slot);
    map.set(e.slot, prev
      ? {
        kcal: prev.kcal + e.nutrients.kcal,
        protein: prev.protein + e.nutrients.protein,
        carbs: prev.carbs + e.nutrients.carbs,
        fat: prev.fat + e.nutrients.fat,
        fiber: prev.fiber + e.nutrients.fiber,
      }
      : { ...e.nutrients });
  }
  return map;
}

/**
 * La comida en la que más se está quedando corto, para señalarla.
 *
 * Solo mira las franjas que ya deberían haber pasado a esta hora: a las nueve
 * de la mañana no tiene sentido decir que va corto de cena.
 */
export function mealBehind(
  targets: MealTarget[],
  eaten: Map<MealSlot, Nutrients>,
  mealTimes: Partial<Record<MealSlot, string>>,
  now: string,
): MealSlot | null {
  const past = targets.filter((t) => {
    const time = mealTimes[t.slot];
    // Sin hora conocida se da por pasada: es mejor señalar de más que callar.
    return !time || time <= now;
  });
  let worst: { slot: MealSlot; ratio: number } | null = null;
  for (const t of past) {
    if (t.kcal <= 0) continue;
    const ratio = (eaten.get(t.slot)?.kcal ?? 0) / t.kcal;
    if (ratio >= 0.85) continue;
    if (!worst || ratio < worst.ratio) worst = { slot: t.slot, ratio };
  }
  return worst?.slot ?? null;
}
