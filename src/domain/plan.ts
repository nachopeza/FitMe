import {
  PLAN_DINNERS, PLAN_MEALS, PLAN_TARGETS, dinnerFor, isTrainingDay,
  type PlanDinner, type PlanMeal, type PlanPart,
} from '../data/plan';
import { scaleNutrients, sumNutrients } from './nutrition';
import type { Food, MacroTargets, MealSlot, Nutrients } from './types';

/**
 * El plan de la hoja, convertido en objetivos y en comidas registrables.
 *
 * Sin React ni base de datos: así se puede probar que las cantidades de la hoja
 * dan de verdad las calorías que la hoja dice, que es la única forma de saber
 * si lo he transcrito bien.
 */

/** Una comida del plan ya resuelta contra la base de alimentos. */
export interface ResolvedMeal {
  id: string;
  name: string;
  slot: MealSlot;
  /** Las partes que existen en la base, con sus macros ya calculados. */
  parts: { food: Food; grams: number; maxGrams?: number; nutrients: Nutrients }[];
  /** Partes de la hoja cuyo alimento no está en la base. Debe ir vacío. */
  missing: string[];
  nutrients: Nutrients;
  note: string;
  optional?: boolean;
  /** El rango de kcal que da la hoja, para poder contrastar. */
  kcalFrom?: number;
  kcalTo?: number;
}

function resolveParts(parts: PlanPart[], foods: Map<string, Food>) {
  const out: ResolvedMeal['parts'] = [];
  const missing: string[] = [];
  for (const p of parts) {
    const food = foods.get(p.foodId);
    if (!food) {
      missing.push(p.foodId);
      continue;
    }
    out.push({
      food,
      grams: p.grams,
      maxGrams: p.maxGrams,
      nutrients: scaleNutrients(food.per100g, p.grams),
    });
  }
  return { parts: out, missing };
}

export function resolveMeal(meal: PlanMeal, foods: Map<string, Food>): ResolvedMeal {
  const { parts, missing } = resolveParts(meal.parts, foods);
  return {
    id: meal.id,
    name: meal.name,
    slot: meal.slot,
    parts,
    missing,
    nutrients: sumNutrients(parts.map((p) => p.nutrients)),
    note: meal.note,
    optional: meal.optional,
    kcalFrom: meal.kcalFrom,
    kcalTo: meal.kcalTo,
  };
}

export function resolveDinner(dinner: PlanDinner, foods: Map<string, Food>): ResolvedMeal {
  const { parts, missing } = resolveParts(dinner.parts, foods);
  return {
    id: `plan-cena-${dinner.weekday}`,
    name: dinner.name,
    slot: 'dinner',
    parts,
    missing,
    nutrients: sumNutrients(parts.map((p) => p.nutrients)),
    note: dinner.note ?? 'Cena de la rotación. Puedes cambiarla por la de otro día.',
  };
}

/**
 * Lo que toca hoy, en orden: las comidas fijas y la cena que rota.
 *
 * El día de la semana entra como parámetro en vez de leerse del reloj para que
 * se pueda probar cualquier día sin tocar la hora del sistema.
 */
export function planForDay(weekday: number, foods: Map<string, Food>): ResolvedMeal[] {
  return [
    ...PLAN_MEALS.map((m) => resolveMeal(m, foods)),
    resolveDinner(dinnerFor(weekday), foods),
  ];
}

/** Lo que el plan suma en un día completo, cena del día incluida. */
export function planDayTotal(weekday: number, foods: Map<string, Food>): Nutrients {
  return sumNutrients(planForDay(weekday, foods).map((m) => m.nutrients));
}

/**
 * Los objetivos de la hoja.
 *
 * Las kcal y la proteína vienen escritas. Los carbohidratos y la grasa no, así
 * que se reparte con ellos la energía que sobra, con la grasa en el 25–30 % —el
 * tramo habitual— y el resto a carbohidratos, que es lo que sostiene el
 * entrenamiento. Van marcados como `manual` a propósito: así el ajuste
 * automático de la app no le reescribe por detrás lo que le mandó su plan.
 */
export function planTargets(): MacroTargets {
  const { kcal, protein } = PLAN_TARGETS;
  const mid = (kcal.min + kcal.max) / 2;
  const fatMin = Math.round((mid * 0.25) / 9);
  const fatMax = Math.round((mid * 0.3) / 9);
  // Lo que queda tras proteína y grasa, a 4 kcal/g.
  const carbsMin = Math.round((kcal.min - protein.max * 4 - fatMax * 9) / 4);
  const carbsMax = Math.round((kcal.max - protein.min * 4 - fatMin * 9) / 4);
  // El centro del rango es la referencia; los extremos, lo que de verdad manda.
  const span = (min: number, max: number) => ({ target: Math.round((min + max) / 2), min, max });
  return {
    kcal: span(kcal.min, kcal.max),
    protein: span(protein.min, protein.max),
    carbs: span(carbsMin, carbsMax),
    fat: span(fatMin, fatMax),
    // 14 g por cada 1.000 kcal, la referencia habitual.
    fiber: span(Math.round((kcal.min / 1000) * 14), Math.round((kcal.max / 1000) * 14)),
    origin: 'manual',
    rationale: [
      `Son los de tu plan: ${kcal.min}–${kcal.max} kcal y ${protein.min}–${protein.max} g de proteína al día.`,
      'La hoja no reparte carbohidratos y grasa, así que la app lo hace: grasa en el 25–30 % de la energía y el resto a carbohidratos, que son los que sostienen el entreno.',
      'Al venir de tu plan, la app no los recalcula sola. Si cambias de plan, cámbialos aquí.',
    ],
  };
}

/**
 * Lo que le falta al plan escrito para llegar a su propio objetivo.
 *
 * Esto salió de medir, y es el dato más útil de todo el módulo: las cantidades
 * de la hoja, al pie de la letra, suman entre 1.760 y 2.000 kcal según el día,
 * y su objetivo son 2.300–2.500. Faltan del orden de 300–550 kcal.
 *
 * No es que la hoja esté mal: es coherente consigo misma. Cada comida trae un
 * rango («850–1.050»), y las cantidades escritas son el extremo BAJO de cada
 * uno. Sumando los extremos altos sí salen 2.400. Lo que pasa es que quien lee
 * «120 g de arroz» pesa 120 g y se queda abajo, y él ya come de menos: ese es
 * justo su problema. Así que la app lo dice en vez de callarlo, y propone los
 * márgenes que la propia hoja da.
 */
export interface PlanGap {
  /** Lo que suman las cantidades escritas. */
  planned: number;
  /** El mínimo del objetivo. */
  targetMin: number;
  /** Cuánto falta para el mínimo. 0 si llega. */
  short: number;
  /** La proteína sí llega: conviene decirlo para no asustar. */
  protein: number;
  proteinMin: number;
}

export function planGap(weekday: number, foods: Map<string, Food>): PlanGap {
  const total = planDayTotal(weekday, foods);
  const targetMin = PLAN_TARGETS.kcal.min;
  return {
    planned: Math.round(total.kcal),
    targetMin,
    short: Math.max(0, Math.round(targetMin - total.kcal)),
    protein: Math.round(total.protein),
    proteinMin: PLAN_TARGETS.protein.min,
  };
}

export interface PlanLever {
  label: string;
  /** Lo que suma, en kcal. */
  kcal: number;
  /** De dónde sale, porque ninguno es invención de la app. */
  from: string;
}

/**
 * Los márgenes que la propia hoja ofrece para subir calorías, de más fácil a
 * menos. Ninguno es invención de la app: todos están escritos en el plan.
 *
 * El del cambio de cena se calcula, no se escribe a mano: depende del día, y en
 * los días flojos —el pescado con patata es el más bajo de la rotación— es el
 * único margen que llega de verdad. La hoja lo autoriza: «puedes cambiarla por
 * cualquiera de las opciones de abajo».
 */
export function planLevers(weekday: number, foods: Map<string, Food>): PlanLever[] {
  const levers: PlanLever[] = [
    { label: '40 g de pan integral + 40 g de pavo en el desayuno', kcal: 150, from: 'la hoja lo da como opción «si tienes hambre»' },
    { label: 'Los 100–200 kcal de antojo', kcal: 150, from: 'la hoja los reserva y dice que no hace falta compensar' },
    { label: '10 g de aceite en la comida en vez de 7', kcal: 27, from: 'la hoja da 5–10 g' },
    { label: '200 g de carne en la comida en vez de 180', kcal: 25, from: 'la hoja da 180–200 g' },
    { label: '200 g de yogur en la merienda en vez de 175', kcal: 15, from: 'la hoja da 150–200 g' },
  ];

  const hoy = resolveDinner(dinnerFor(weekday), foods).nutrients.kcal;
  let mejor = { nombre: '', kcal: hoy };
  for (const d of PLAN_DINNERS) {
    const k = resolveDinner(d, foods).nutrients.kcal;
    if (k > mejor.kcal) mejor = { nombre: d.name, kcal: k };
  }
  const diferencia = Math.round(mejor.kcal - hoy);
  if (diferencia > 40) {
    levers.unshift({
      label: `Cambiar la cena por ${mejor.nombre.toLowerCase()}`,
      kcal: diferencia,
      from: 'la hoja deja cambiar la cena por cualquiera de la rotación',
    });
  }
  return levers;
}

export { dinnerFor, isTrainingDay };
