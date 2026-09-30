import {
  EMPTY_NUTRIENTS,
  type ActivityLevel,
  type DayType,
  type Food,
  type Goal,
  type Hunger,
  type MacroKey,
  type MacroTargets,
  type Nutrients,
  type Profile,
  type Sex,
  type TargetRange,
} from './types';

// ───────────────────────────── Aritmética de nutrientes ─────────────────────────────

export function scaleNutrients(per100g: Nutrients, grams: number): Nutrients {
  const k = grams / 100;
  return {
    kcal: per100g.kcal * k,
    protein: per100g.protein * k,
    carbs: per100g.carbs * k,
    fat: per100g.fat * k,
    fiber: per100g.fiber * k,
    satFat: (per100g.satFat ?? 0) * k,
    sugars: (per100g.sugars ?? 0) * k,
    sodium: (per100g.sodium ?? 0) * k,
  };
}

export function addNutrients(a: Nutrients, b: Nutrients): Nutrients {
  return {
    kcal: a.kcal + b.kcal,
    protein: a.protein + b.protein,
    carbs: a.carbs + b.carbs,
    fat: a.fat + b.fat,
    fiber: a.fiber + b.fiber,
    satFat: (a.satFat ?? 0) + (b.satFat ?? 0),
    sugars: (a.sugars ?? 0) + (b.sugars ?? 0),
    sodium: (a.sodium ?? 0) + (b.sodium ?? 0),
  };
}

export function sumNutrients(list: Nutrients[]): Nutrients {
  return list.reduce(addNutrients, { ...EMPTY_NUTRIENTS });
}

export function roundNutrients(n: Nutrients): Nutrients {
  return {
    kcal: Math.round(n.kcal),
    protein: Math.round(n.protein * 10) / 10,
    carbs: Math.round(n.carbs * 10) / 10,
    fat: Math.round(n.fat * 10) / 10,
    fiber: Math.round(n.fiber * 10) / 10,
    satFat: Math.round((n.satFat ?? 0) * 10) / 10,
    sugars: Math.round((n.sugars ?? 0) * 10) / 10,
    sodium: Math.round(n.sodium ?? 0),
  };
}

/**
 * Energía calculada a partir de los macros, con el convenio europeo: los
 * carbohidratos declarados NO incluyen la fibra, y la fibra aporta ~2 kcal/g.
 * Es el convenio de las etiquetas españolas y de OpenFoodFacts.
 */
export function energyFromMacros(n: Nutrients): number {
  return n.protein * 4 + n.carbs * 4 + n.fat * 9 + n.fiber * 2;
}

/**
 * Coherencia energética de un alimento: desviación relativa y absoluta entre
 * las kcal declaradas y las que salen de sus macros.
 *
 * No siempre cuadran, y eso no es un error: la carne usa factores específicos,
 * el aceite pesa menos de lo que predice Atwater y los frutos secos se absorben
 * de forma incompleta. Sirve para detectar erratas de captura, no para "corregir"
 * etiquetas a ciegas.
 */
export function energyMismatch(n: Nutrients): number {
  const fromMacros = energyFromMacros(n);
  if (n.kcal <= 0) return fromMacros > 0 ? 1 : 0;
  return Math.abs(fromMacros - n.kcal) / n.kcal;
}

export function energyMismatchKcal(n: Nutrients): number {
  return Math.abs(energyFromMacros(n) - n.kcal);
}

// ───────────────────────────── Raciones y estados ─────────────────────────────

/** Convierte una cantidad expresada en raciones/unidades a gramos efectivos. */
export function resolveGrams(
  food: Food,
  quantity: number,
  unit: 'g' | 'ml' | 'portion',
  portionLabel?: string,
): number {
  if (unit !== 'portion') return quantity;
  const portion =
    food.portions.find((p) => p.label === portionLabel) ??
    food.portions.find((p) => p.isDefault) ??
    food.portions[0];
  return quantity * (portion?.grams ?? 100);
}

/**
 * Gramos cocinados que rinden unos gramos crudos (y al revés).
 * Sin `cookedYield` no se inventa la conversión: se devuelve null.
 */
export function convertState(food: Food, grams: number, to: 'raw' | 'cooked'): number | null {
  if (!food.cookedYield) return null;
  if (food.state === 'raw' && to === 'cooked') return grams * food.cookedYield;
  if (food.state === 'cooked' && to === 'raw') return grams / food.cookedYield;
  return grams;
}

// ───────────────────────────── Gasto energético ─────────────────────────────

/** Mifflin-St Jeor: el estimador con menos error medio en población sana. */
export function bmr(sex: Sex, weightKg: number, heightCm: number, age: number): number {
  const base = 10 * weightKg + 6.25 * heightCm - 5 * age;
  return sex === 'male' ? base + 5 : base - 161;
}

/**
 * Factor de actividad NO relacionada con el ejercicio (NEAT), sobre el
 * metabolismo basal.
 *
 * Ojo: NO son los multiplicadores clásicos de Mifflin (1,2 / 1,375 / 1,55…).
 * Aquellos ya incluyen el ejercicio, y aquí el entrenamiento y los pasos se
 * suman aparte, de forma explícita. Usar los clásicos contaría la actividad dos
 * veces y sobreestimaría el gasto en un 15-20%: para alguien de 66 kg eso son
 * unas 400 kcal/día de más, suficiente para convertir una ganancia controlada en
 * una ganancia de grasa.
 */
const BASE_FACTOR: Record<ActivityLevel, number> = {
  sedentary: 1.15,
  light: 1.2,
  moderate: 1.28,
  active: 1.38,
  veryActive: 1.48,
};

/**
 * Coste aproximado de una sesión de fuerza. MET ~5 para hipertrofia con
 * descansos: kcal/min = MET * 3.5 * kg / 200. Es una estimación deliberadamente
 * conservadora: sobreestimar el gasto del entrenamiento es el error clásico.
 */
export function trainingKcal(weightKg: number, minutes: number, met = 5): number {
  return (met * 3.5 * weightKg * minutes) / 200;
}

/** Coste aproximado de caminar, por encima de lo ya contado en el factor base. */
export function stepsKcal(weightKg: number, steps: number, baselineSteps: number): number {
  const extra = steps - baselineSteps;
  // ~0.00045 kcal por paso y por kg: ~0.03 kcal/paso a 66 kg.
  return extra * 0.00045 * weightKg;
}

export interface MaintenanceEstimate {
  bmr: number;
  maintenance: number;
  fromTraining: number;
  fromSteps: number;
  notes: string[];
}

/**
 * Mantenimiento medio semanal. Se calcula como media, no día a día: la app
 * trabaja con tendencias, y el gasto real de un día concreto no es observable.
 */
export function estimateMaintenance(p: {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  typicalSteps: number;
  trainingDaysPerWeek: number;
  trainingMinutes?: number;
}): MaintenanceEstimate {
  const base = bmr(p.sex, p.weightKg, p.heightCm, p.age);
  const factor = BASE_FACTOR[p.activityLevel];
  // El factor base ya asume unos 5.000 pasos diarios de vida cotidiana.
  const fromSteps = Math.max(0, stepsKcal(p.weightKg, p.typicalSteps, 5000));
  const minutes = p.trainingMinutes ?? 55;
  const fromTraining = (trainingKcal(p.weightKg, minutes) * p.trainingDaysPerWeek) / 7;
  const maintenance = base * factor + fromSteps + fromTraining;
  return {
    bmr: Math.round(base),
    maintenance: Math.round(maintenance),
    fromTraining: Math.round(fromTraining),
    fromSteps: Math.round(fromSteps),
    notes: [
      `Metabolismo basal estimado: ${Math.round(base)} kcal.`,
      `Actividad diaria fuera del entrenamiento: factor ${factor} sobre el basal.`,
      `Entrenamiento: ~${Math.round(fromTraining)} kcal/día de media (${p.trainingDaysPerWeek} sesiones/semana).`,
      `Pasos por encima de la base: ~${Math.round(fromSteps)} kcal/día.`,
      'Toda estimación de gasto tiene un margen de ±10-15%. Se ajustará con tu peso real.',
    ],
  };
}

// ───────────────────────────── Objetivos ─────────────────────────────

/** Superávit/déficit relativo por objetivo. Nada agresivo por diseño. */
const GOAL_DELTA: Record<Goal, { pct: number; label: string }> = {
  leanGain: { pct: 0.1, label: 'ganancia muscular controlada' },
  maintain: { pct: 0, label: 'mantenimiento' },
  recomp: { pct: 0.02, label: 'recomposición' },
  slowCut: { pct: -0.12, label: 'definición suave' },
};

/** Proteína objetivo en g/kg de peso corporal. */
const PROTEIN_PER_KG: Record<Goal, number> = {
  leanGain: 2.0,
  maintain: 1.8,
  recomp: 2.1,
  slowCut: 2.3,
};

function range(target: number, minPct: number, maxPct: number, step = 1): TargetRange {
  const r = (v: number) => Math.round(v / step) * step;
  return { target: r(target), min: r(target * minPct), max: r(target * maxPct) };
}

export interface ComputeTargetsInput {
  sex: Sex;
  weightKg: number;
  heightCm: number;
  age: number;
  activityLevel: ActivityLevel;
  typicalSteps: number;
  trainingDaysPerWeek: number;
  trainingMinutes?: number;
  goal: Goal;
  /** Ajuste manual acumulado en kcal (del usuario o del motor de tendencias). */
  kcalOffset?: number;
  /** Si el usuario reporta hinchazón habitual, la fibra objetivo baja. */
  digestiveTolerance?: 'low' | 'normal';
}

/**
 * Objetivos diarios medios con rangos aceptables.
 *
 * Orden de reparto: primero proteína (por kg de peso, es la prioridad del
 * objetivo), luego grasa (mínimo hormonal y saciedad), y los carbohidratos
 * reciben la energía restante, porque son el combustible del entrenamiento.
 */
export function computeTargets(input: ComputeTargetsInput): MacroTargets {
  const est = estimateMaintenance(input);
  const goal = GOAL_DELTA[input.goal];
  const offset = input.kcalOffset ?? 0;
  const kcalTarget = Math.round(est.maintenance * (1 + goal.pct) + offset);

  const proteinTarget = Math.round(input.weightKg * PROTEIN_PER_KG[input.goal]);

  // Grasa: el mayor entre el mínimo saludable (0,8 g/kg) y el 25% de la energía.
  const fatFloor = input.weightKg * 0.8;
  const fatFromPct = (kcalTarget * 0.25) / 9;
  const fatTarget = Math.round(Math.max(fatFloor, fatFromPct));

  // Carbohidratos: energía restante. Nunca por debajo de 3 g/kg en ganancia.
  const kcalFromProtein = proteinTarget * 4;
  const kcalFromFat = fatTarget * 9;
  const carbsTarget = Math.max(
    Math.round(input.weightKg * 3),
    Math.round((kcalTarget - kcalFromProtein - kcalFromFat) / 4),
  );

  // Fibra: 13 g por 1.000 kcal, con techo por tolerancia digestiva.
  const fiberRaw = (kcalTarget / 1000) * 13;
  const fiberCap = input.digestiveTolerance === 'low' ? 25 : 38;
  const fiberTarget = Math.round(Math.min(fiberRaw, fiberCap));

  const rationale = [
    ...est.notes,
    `Objetivo "${goal.label}": ${goal.pct >= 0 ? '+' : ''}${Math.round(goal.pct * 100)}% sobre el mantenimiento.`,
    `Proteína a ${PROTEIN_PER_KG[input.goal]} g por kg de peso.`,
    `Grasa al 25% de la energía, con un mínimo de 0,8 g/kg.`,
    `Carbohidratos con la energía restante (mínimo 3 g/kg para sostener el entrenamiento).`,
    input.digestiveTolerance === 'low'
      ? 'Fibra limitada porque has reportado molestias digestivas con frecuencia.'
      : 'Fibra a 13 g por cada 1.000 kcal.',
  ];
  if (offset !== 0) {
    rationale.push(
      `Incluye un ajuste de ${offset > 0 ? '+' : ''}${offset} kcal a partir de tu evolución real.`,
    );
  }

  return {
    kcal: range(kcalTarget, 0.93, 1.07, 10),
    protein: range(proteinTarget, 0.9, 1.15),
    carbs: range(carbsTarget, 0.85, 1.15),
    fat: range(fatTarget, 0.8, 1.2),
    fiber: { target: fiberTarget, min: Math.round(fiberTarget * 0.7), max: Math.round(fiberTarget * 1.4) },
    origin: offset !== 0 ? 'adjusted' : 'computed',
    rationale,
  };
}

// ───────────────────────────── Tipo de día ─────────────────────────────

export function classifyDay(opts: {
  trained: boolean;
  steps?: number;
  typicalSteps: number;
}): DayType {
  const { trained, steps, typicalSteps } = opts;
  if (trained) return 'training';
  if (steps != null) {
    if (steps >= Math.max(12000, typicalSteps * 1.4)) return 'highActivity';
    if (steps <= Math.min(4000, typicalSteps * 0.6)) return 'lowActivity';
  }
  return 'rest';
}

/**
 * Cuánto se desplaza la energía según el tipo de día, en fracción del objetivo.
 * Los valores se compensan entre sí: la media semanal no cambia, solo se
 * reparte. Un día de descanso NO es un día de dieta.
 */
const DAY_SHIFT: Record<DayType, number> = {
  training: 0.08,
  highActivity: 0.05,
  rest: -0.07,
  lowActivity: -0.1,
};

/**
 * Objetivos del día concreto. La proteína se mantiene estable (su función es
 * estructural, no energética); la grasa se mueve poco; el ajuste recae sobre
 * los carbohidratos, que es donde tiene sentido fisiológico.
 */
export function targetsForDay(base: MacroTargets, dayType: DayType): MacroTargets {
  const shift = DAY_SHIFT[dayType];
  const kcalTarget = Math.round(base.kcal.target * (1 + shift));
  const deltaKcal = kcalTarget - base.kcal.target;
  // 80% del desplazamiento va a carbohidratos, 20% a grasa.
  const carbsTarget = Math.max(0, Math.round(base.carbs.target + (deltaKcal * 0.8) / 4));
  const fatTarget = Math.max(
    Math.round(base.fat.target * 0.75),
    Math.round(base.fat.target + (deltaKcal * 0.2) / 9),
  );

  const label =
    shift > 0
      ? `Hoy sumamos ~${deltaKcal} kcal, sobre todo en carbohidratos, porque es un día de más demanda.`
      : shift < 0
        ? `Hoy restamos ~${Math.abs(deltaKcal)} kcal en carbohidratos. La proteína no baja.`
        : 'Hoy mantenemos los objetivos medios.';

  return {
    kcal: range(kcalTarget, 0.93, 1.07, 10),
    protein: base.protein,
    carbs: range(carbsTarget, 0.85, 1.15),
    fat: range(fatTarget, 0.8, 1.2),
    fiber: base.fiber,
    origin: base.origin,
    rationale: [label, ...base.rationale],
  };
}

// ───────────────────────────── Estado respecto al rango ─────────────────────────────

export type MacroStatus = 'under' | 'inRange' | 'nearLimit' | 'over';

export function macroStatus(value: number, r: TargetRange): MacroStatus {
  if (value < r.min) return 'under';
  if (value > r.max) return 'over';
  // "Cerca del límite": último 8% del rango por arriba.
  if (value > r.max - (r.max - r.min) * 0.08) return 'nearLimit';
  return 'inRange';
}

export const STATUS_DOT: Record<MacroStatus, string> = {
  under: '⚪',
  inRange: '🟢',
  nearLimit: '🟡',
  over: '🔴',
};

export const STATUS_TEXT: Record<MacroStatus, string> = {
  under: 'Por debajo del rango',
  inRange: 'Dentro del rango',
  nearLimit: 'Cerca del límite',
  over: 'Por encima del rango',
};

export function remainingFor(consumed: Nutrients, targets: MacroTargets) {
  return {
    kcal: targets.kcal.target - consumed.kcal,
    protein: targets.protein.target - consumed.protein,
    carbs: targets.carbs.target - consumed.carbs,
    fat: targets.fat.target - consumed.fat,
    fiber: targets.fiber.target - consumed.fiber,
  };
}

export function targetValue(targets: MacroTargets, key: MacroKey): TargetRange {
  return targets[key];
}

export function consumedValue(n: Nutrients, key: MacroKey): number {
  return n[key];
}

// ───────────────────────────── Apetito ─────────────────────────────

/**
 * Cuando hay poco apetito, la app no debe proponer volumen. Este índice se usa
 * para penalizar alimentos voluminosos en el recomendador.
 */
export function volumeToleranceFor(hunger: Hunger): 'low' | 'medium' | 'high' {
  if (hunger === 'veryLow') return 'low';
  if (hunger === 'low') return 'medium';
  return 'high';
}

export function profileAge(p: Pick<Profile, 'birthYear'>, now = new Date()): number {
  return now.getFullYear() - p.birthYear;
}
