import type { IsoDate, MealEntry, MealSlot, Nutrients } from './types';

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

/**
 * Copia las comidas de un día a otra fecha.
 *
 * Come casi lo mismo todos los días, así que volver a teclearlo cada mañana es
 * la friccción que hace que deje de registrar. Traer un día entero y luego
 * cambiar lo que varíe es muchísimo menos trabajo que montarlo de cero.
 *
 * Se conservan la franja, la hora y las cantidades; cambian la fecha y los
 * identificadores, porque son comidas nuevas y no las mismas en dos sitios:
 * compartir el id haría que borrar una borrase la otra.
 *
 * `newId` entra como parámetro para que la función siga siendo pura y se pueda
 * probar sin depender de un reloj ni de un generador aleatorio.
 */
export function copyEntriesToDate(
  entries: MealEntry[],
  date: IsoDate,
  newId: (seed: number) => string,
): MealEntry[] {
  return entries.map((entry, i) => {
    const id = newId(i);
    return {
      ...entry,
      id,
      date,
      items: entry.items.map((item, j) => ({ ...item, id: `i-${id}-${j}` })),
      createdAt: Date.now(),
      // La copia no hereda de dónde salió el original: lo que importa de un
      // registro es que lo confirmó él, y esta la confirma al copiar.
      method: 'saved',
    };
  });
}
