import type { MacroKey, Nutrients } from './types';

/**
 * Lo que empuja a registrar.
 *
 * Un número suelto —"te faltan 940 kcal"— no se imagina y por eso no mueve a
 * nadie. Dos plátanos y un batido sí. Este módulo traduce el hueco del día a
 * comida concreta, dice qué macro va más atrasado para que el color de la
 * pantalla lo señale, y cuenta los días seguidos registrando.
 *
 * Es dominio puro: sin React, sin base de datos y sin fechas implícitas.
 */

/** Macro que va más atrasado en proporción a su objetivo. */
export function behindMacro(
  eaten: Pick<Nutrients, 'protein' | 'carbs' | 'fat'>,
  target: Pick<Nutrients, 'protein' | 'carbs' | 'fat'>,
): MacroKey {
  const ratio = (a: number, b: number) => (b > 0 ? a / b : 1);
  const entries: [MacroKey, number][] = [
    ['protein', ratio(eaten.protein, target.protein)],
    ['carbs', ratio(eaten.carbs, target.carbs)],
    ['fat', ratio(eaten.fat, target.fat)],
  ];
  // La proteína gana los empates: es la que condiciona la hipertrofia.
  return entries.sort((a, b) => a[1] - b[1] || (a[0] === 'protein' ? -1 : 1))[0][0];
}

/**
 * Macro que domina el aporte de un alimento, para teñir su casilla.
 *
 * Devuelve null cuando está repartido: teñir de un color algo que aporta tres
 * cosas por igual sería mentir con el color.
 */
export function dominantMacro(n: Nutrients): 'protein' | 'carbs' | 'fat' | null {
  const kcal = n.protein * 4 + n.carbs * 4 + n.fat * 9;
  if (kcal < 20) return null;
  const share = {
    protein: (n.protein * 4) / kcal,
    carbs: (n.carbs * 4) / kcal,
    fat: (n.fat * 9) / kcal,
  };
  const [key, value] = Object.entries(share).sort((a, b) => b[1] - a[1])[0] as
    ['protein' | 'carbs' | 'fat', number];
  return value >= 0.45 ? key : null;
}

export interface GapCandidate {
  id: string;
  name: string;
  kcal: number;
  protein: number;
}

export interface GapPart extends GapCandidate {
  count: number;
}

/**
 * Qué comer para cerrar el hueco, con lo que él ya come.
 *
 * Elige con avidez, priorizando lo que mejor resuelve la proteína por caloría
 * mientras falte proteína, y lo más calórico cuando ya solo falta energía. Se
 * detiene al cubrir el 85% del hueco: pasarse de largo es peor consejo que
 * quedarse algo corto.
 */
export function closeTheGap(
  kcalLeft: number,
  proteinLeft: number,
  candidates: GapCandidate[],
  { maxItems = 3, maxEach = 3 } = {},
): GapPart[] {
  const usable = candidates.filter((c) => c.kcal >= 40 && c.kcal <= Math.max(120, kcalLeft));
  if (kcalLeft < 80 || usable.length === 0) return [];

  const picked = new Map<string, GapPart>();
  let kcal = kcalLeft;
  let protein = proteinLeft;

  for (let guard = 0; guard < 12; guard++) {
    if (kcal <= kcalLeft * 0.15) break;
    const pool = usable.filter((c) => {
      const already = picked.get(c.id)?.count ?? 0;
      if (already >= maxEach) return false;
      if (!picked.has(c.id) && picked.size >= maxItems) return false;
      // No se propone algo que se pase mucho de lo que queda.
      return c.kcal <= kcal * 1.25;
    });
    if (!pool.length) break;

    const score = (c: GapCandidate) => (protein > 5
      // Mientras falte proteína, manda la densidad proteica.
      ? c.protein / Math.max(1, c.kcal)
      // Cuando ya solo falta energía, lo que más hueco tape.
      : c.kcal / Math.max(1, kcal));
    const best = pool.reduce((a, b) => (score(b) > score(a) ? b : a));

    const prev = picked.get(best.id);
    picked.set(best.id, { ...best, count: (prev?.count ?? 0) + 1 });
    kcal -= best.kcal;
    protein -= best.protein;
  }

  return [...picked.values()].sort((a, b) => b.count * b.kcal - a.count * a.kcal);
}

/**
 * Días seguidos con algo registrado, contando hacia atrás desde hoy.
 *
 * Si hoy todavía no hay nada no se rompe la racha: el día no ha terminado, y
 * castigar a las nueve de la mañana sería absurdo.
 */
export function loggingStreak(datesWithFood: Iterable<string>, today: string): number {
  const set = new Set(datesWithFood);
  const day = (iso: string, delta: number) => {
    const d = new Date(`${iso}T12:00:00Z`);
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString().slice(0, 10);
  };
  let streak = 0;
  // Hoy sin registrar no cuenta pero tampoco rompe: se empieza a contar ayer.
  let cursor = set.has(today) ? today : day(today, -1);
  while (set.has(cursor)) {
    streak++;
    cursor = day(cursor, -1);
  }
  return streak;
}
