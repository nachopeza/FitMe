import { addDays, daysBetween, lastNDays, toIsoDate, weekStart } from './dates';
import { sumNutrients } from './nutrition';
import type {
  AdjustmentSuggestion,
  ConsistencyScore,
  DayLog,
  Goal,
  IsoDate,
  MacroTargets,
  MealEntry,
  Nutrients,
  TrendReading,
  WeeklySummary,
  WeightEntry,
} from './types';

// ───────────────────────────── Agregación diaria ─────────────────────────────

export function nutrientsForEntries(entries: MealEntry[]): Nutrients {
  return sumNutrients(entries.flatMap((e) => e.items.map((i) => i.nutrients)));
}

export function groupEntriesByDate(entries: MealEntry[]): Map<IsoDate, MealEntry[]> {
  const map = new Map<IsoDate, MealEntry[]>();
  for (const e of entries) {
    const list = map.get(e.date);
    if (list) list.push(e);
    else map.set(e.date, [e]);
  }
  return map;
}

// ───────────────────────────── Peso: media móvil y tendencia ─────────────────────────────

/**
 * Media diaria de las pesadas (puede haber más de una al día) y luego media
 * móvil de 7 días. Un solo día NUNCA se usa para decidir nada: el peso diario
 * se mueve por agua, glucógeno, sodio y contenido intestinal.
 */
export function dailyWeights(entries: WeightEntry[]): Map<IsoDate, number> {
  const buckets = new Map<IsoDate, number[]>();
  for (const w of entries) {
    const arr = buckets.get(w.date);
    if (arr) arr.push(w.kg);
    else buckets.set(w.date, [w.kg]);
  }
  const out = new Map<IsoDate, number>();
  for (const [date, kgs] of buckets) {
    out.set(date, kgs.reduce((a, b) => a + b, 0) / kgs.length);
  }
  return out;
}

/** Media móvil centrada en la ventana anterior de `window` días, con huecos. */
export function movingAverage(
  daily: Map<IsoDate, number>,
  end: IsoDate,
  window = 7,
): number | null {
  const values: number[] = [];
  for (let i = 0; i < window; i++) {
    const v = daily.get(addDays(end, -i));
    if (v != null) values.push(v);
  }
  if (values.length < 2) return null;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/** Pendiente por mínimos cuadrados en kg/semana sobre las pesadas del rango. */
export function weightSlopePerWeek(
  daily: Map<IsoDate, number>,
  from: IsoDate,
  to: IsoDate,
): number | null {
  const pts: { x: number; y: number }[] = [];
  for (const [date, kg] of daily) {
    if (date < from || date > to) continue;
    pts.push({ x: daysBetween(from, date), y: kg });
  }
  if (pts.length < 4) return null;
  const n = pts.length;
  const sx = pts.reduce((a, p) => a + p.x, 0);
  const sy = pts.reduce((a, p) => a + p.y, 0);
  const sxy = pts.reduce((a, p) => a + p.x * p.y, 0);
  const sxx = pts.reduce((a, p) => a + p.x * p.x, 0);
  const denom = n * sxx - sx * sx;
  if (denom === 0) return null;
  const slopePerDay = (n * sxy - sx * sy) / denom;
  return slopePerDay * 7;
}

export function readTrend(weights: WeightEntry[], today: IsoDate = toIsoDate()): TrendReading {
  const daily = dailyWeights(weights);
  const ma7 = movingAverage(daily, today, 7);
  const ma7Prev = movingAverage(daily, addDays(today, -7), 7);
  const from = addDays(today, -20);
  const slope = weightSlopePerWeek(daily, from, today);
  let weighInDays = 0;
  for (const d of lastNDays(14, today)) if (daily.has(d)) weighInDays++;

  let direction: TrendReading['direction'] = 'unknown';
  if (slope != null) {
    // Umbral de ruido: por debajo de 0,15 kg/semana no se distingue de la nada.
    if (slope > 0.15) direction = 'up';
    else if (slope < -0.15) direction = 'down';
    else direction = 'flat';
  } else if (ma7 != null && ma7Prev != null) {
    const d = ma7 - ma7Prev;
    direction = d > 0.15 ? 'up' : d < -0.15 ? 'down' : 'flat';
  }

  return {
    weightMa7: ma7,
    weightMa7Prev: ma7Prev,
    weeklyChangeKg: slope ?? (ma7 != null && ma7Prev != null ? ma7 - ma7Prev : null),
    weighInDays,
    direction,
  };
}

// ───────────────────────────── Resumen semanal ─────────────────────────────

export function consistencyScore(input: {
  proteinDays: number;
  energyDays: number;
  loggedDays: number;
  trainings: number;
  expectedTrainings: number;
}): ConsistencyScore {
  const { proteinDays, energyDays, loggedDays, trainings, expectedTrainings } = input;
  // Ponderación: proteína y registro pesan más que acertar la energía al detalle.
  const pProtein = loggedDays ? proteinDays / loggedDays : 0;
  const pEnergy = loggedDays ? energyDays / loggedDays : 0;
  const pLog = loggedDays / 7;
  const pTrain = expectedTrainings ? Math.min(1, trainings / expectedTrainings) : 1;
  const value = Math.round((pProtein * 0.35 + pEnergy * 0.2 + pLog * 0.25 + pTrain * 0.2) * 100);
  const label =
    value >= 80
      ? 'Muy consistente'
      : value >= 60
        ? 'Consistente'
        : value >= 40
          ? 'Irregular'
          : 'Pocos datos';
  return { value, proteinOk: proteinDays, energyOk: energyDays, loggedDays, trainings, label };
}

export function weeklySummary(input: {
  week: IsoDate;
  entries: MealEntry[];
  days: Map<IsoDate, DayLog>;
  weights: WeightEntry[];
  targets: MacroTargets;
  expectedTrainings: number;
}): WeeklySummary {
  const start = weekStart(input.week);
  const dates: IsoDate[] = [];
  for (let i = 0; i < 7; i++) dates.push(addDays(start, i));

  const byDate = groupEntriesByDate(input.entries);
  const daily = dailyWeights(input.weights);

  let loggedDays = 0;
  let proteinDays = 0;
  let energyDays = 0;
  let trainings = 0;
  let stepsSum = 0;
  let stepsDays = 0;
  let weightSum = 0;
  let weightDays = 0;
  const totals: Nutrients[] = [];

  for (const d of dates) {
    const dayEntries = byDate.get(d);
    if (dayEntries?.length) {
      loggedDays++;
      const n = nutrientsForEntries(dayEntries);
      totals.push(n);
      if (n.protein >= input.targets.protein.min) proteinDays++;
      if (n.kcal >= input.targets.kcal.min && n.kcal <= input.targets.kcal.max) energyDays++;
    }
    const day = input.days.get(d);
    if (day?.training) trainings++;
    if (day?.steps != null) {
      stepsSum += day.steps;
      stepsDays++;
    }
    const w = daily.get(d);
    if (w != null) {
      weightSum += w;
      weightDays++;
    }
  }

  const sum = sumNutrients(totals);
  const div = loggedDays || 1;

  return {
    weekStart: start,
    daysLogged: loggedDays,
    avgKcal: Math.round(sum.kcal / div),
    avgProtein: Math.round(sum.protein / div),
    avgCarbs: Math.round(sum.carbs / div),
    avgFat: Math.round(sum.fat / div),
    avgFiber: Math.round(sum.fiber / div),
    avgSteps: stepsDays ? Math.round(stepsSum / stepsDays) : 0,
    trainings,
    avgWeightKg: weightDays ? Math.round((weightSum / weightDays) * 10) / 10 : null,
    loggingRate: loggedDays / 7,
    consistency: consistencyScore({
      proteinDays,
      energyDays,
      loggedDays,
      trainings,
      expectedTrainings: input.expectedTrainings,
    }),
  };
}

// ───────────────────────────── Ajuste automático ─────────────────────────────

/** Ritmo de cambio de peso deseable por objetivo, en kg/semana. */
const TARGET_RATE: Record<Goal, { min: number; max: number }> = {
  leanGain: { min: 0.1, max: 0.3 },
  maintain: { min: -0.15, max: 0.15 },
  recomp: { min: -0.05, max: 0.15 },
  slowCut: { min: -0.5, max: -0.2 },
};

/** Paso máximo de ajuste. Nunca cambios extremos. */
const MAX_STEP_KCAL = 150;

/**
 * Decide si conviene mover la ingesta, con qué magnitud y por qué.
 *
 * Requisitos mínimos antes de tocar nada: 2 semanas de datos, al menos 8 días
 * con registro y 6 pesadas. Sin eso devuelve 'needMoreData' y dice qué falta:
 * es mejor no ajustar que ajustar sobre ruido.
 */
export function suggestAdjustment(input: {
  goal: Goal;
  weeks: WeeklySummary[];
  trend: TrendReading;
  targets: MacroTargets;
  /** Media de rendimiento percibido en entrenamiento (1–5), si existe. */
  avgPerformance?: number | null;
}): AdjustmentSuggestion {
  const { goal, weeks, trend, targets } = input;
  const recent = weeks.slice(-2);
  const loggedDays = recent.reduce((a, w) => a + w.daysLogged, 0);
  const trainings = recent.reduce((a, w) => a + w.trainings, 0);
  const avgKcal = recent.length
    ? Math.round(recent.reduce((a, w) => a + w.avgKcal * w.daysLogged, 0) / (loggedDays || 1))
    : 0;
  const avgProtein = recent.length
    ? Math.round(recent.reduce((a, w) => a + w.avgProtein * w.daysLogged, 0) / (loggedDays || 1))
    : 0;

  const missing: string[] = [];
  if (recent.length < 2) missing.push('Al menos 2 semanas completas de datos.');
  if (loggedDays < 8) missing.push(`Más días registrados (llevas ${loggedDays} de los últimos 14).`);
  if (trend.weighInDays < 6) missing.push(`Más pesadas (llevas ${trend.weighInDays} en 2 semanas; con 3-4 por semana basta).`);
  if (trend.weeklyChangeKg == null) missing.push('Una tendencia de peso calculable.');

  if (missing.length) {
    return {
      action: 'needMoreData',
      deltaKcal: 0,
      reasons: [
        'Todavía no hay información suficiente para ajustar sin riesgo de reaccionar al ruido.',
        'Mientras tanto, lo más útil es registrar con regularidad y pesarte varias veces por semana.',
      ],
      missing,
      confidence: 'low',
    };
  }

  const rate = trend.weeklyChangeKg as number;
  const band = TARGET_RATE[goal];
  const reasons: string[] = [
    `Tendencia de peso: ${rate >= 0 ? '+' : ''}${rate.toFixed(2)} kg/semana (media móvil, no una pesada aislada).`,
    `Ingesta media real: ${avgKcal} kcal/día y ${avgProtein} g de proteína.`,
    `Entrenamientos en 2 semanas: ${trainings}.`,
  ];

  const proteinOk = avgProtein >= targets.protein.min;
  if (!proteinOk) {
    reasons.push(
      'La proteína media está por debajo del rango. Antes de mover las calorías conviene asegurarla: es lo que más condiciona la ganancia muscular.',
    );
    return { action: 'hold', deltaKcal: 0, reasons, missing: [], confidence: 'medium' };
  }

  if (rate < band.min) {
    // Falta energía para progresar: subir, proporcional a lo lejos que estemos.
    const gap = band.min - rate;
    // ~7.700 kcal por kg → 1.100 kcal/semana por cada 0,1 kg/semana ≈ 157 kcal/día.
    const raw = Math.round((gap * 7700) / 7);
    const delta = Math.min(MAX_STEP_KCAL, Math.max(50, Math.round(raw / 25) * 25));
    reasons.push(
      `El ritmo está por debajo de la banda objetivo (${band.min}–${band.max} kg/semana) para ${goal === 'leanGain' ? 'ganar músculo de forma controlada' : 'tu objetivo'}.`,
      `Propuesta: +${delta} kcal/día, sobre todo en carbohidratos alrededor del entrenamiento.`,
      'Es un ajuste pequeño a propósito: se revisa en 2 semanas.',
    );
    return { action: 'increase', deltaKcal: delta, reasons, missing: [], confidence: 'medium' };
  }

  if (rate > band.max) {
    const gap = rate - band.max;
    const raw = Math.round((gap * 7700) / 7);
    const delta = -Math.min(MAX_STEP_KCAL, Math.max(50, Math.round(raw / 25) * 25));
    reasons.push(
      `El ritmo va por encima de la banda objetivo (${band.min}–${band.max} kg/semana). Subir más rápido no añade músculo, añade grasa.`,
      `Propuesta: ${delta} kcal/día, recortando de carbohidratos y grasa, sin tocar la proteína.`,
    );
    return { action: 'decrease', deltaKcal: delta, reasons, missing: [], confidence: 'medium' };
  }

  reasons.push(
    `El ritmo está dentro de la banda objetivo (${band.min}–${band.max} kg/semana). Lo mejor ahora es no cambiar nada.`,
  );
  return { action: 'hold', deltaKcal: 0, reasons, missing: [], confidence: 'high' };
}

// ───────────────────────────── Distribución de proteína ─────────────────────────────

export interface ProteinDistribution {
  bySlot: { slot: string; grams: number; time: string }[];
  /** Coeficiente de variación: alto = muy concentrada en pocas comidas. */
  concentration: number;
  /** Número de comidas con al menos 25 g de proteína. */
  effectiveDoses: number;
  message: string | null;
  suggestion: string | null;
}

/**
 * Analiza cómo se reparte la proteína, no solo el total.
 *
 * Se usa un umbral de ~25-30 g por comida como "dosis efectiva" para estimular
 * síntesis proteica. Es una guía, no una obligación: el total del día sigue
 * siendo lo que más importa.
 */
export function proteinDistribution(entries: MealEntry[], totalTarget: number): ProteinDistribution {
  const bySlot = entries
    .map((e) => ({
      slot: e.name || e.slot,
      grams: Math.round(e.items.reduce((a, i) => a + i.nutrients.protein, 0)),
      time: e.time,
    }))
    .filter((s) => s.grams > 0)
    .sort((a, b) => a.time.localeCompare(b.time));

  if (bySlot.length < 2) {
    return { bySlot, concentration: 0, effectiveDoses: bySlot.filter((s) => s.grams >= 25).length, message: null, suggestion: null };
  }

  const values = bySlot.map((s) => s.grams);
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  const sd = Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
  const concentration = mean > 0 ? sd / mean : 0;
  const effectiveDoses = values.filter((v) => v >= 25).length;
  const total = values.reduce((a, b) => a + b, 0);

  let message: string | null = null;
  let suggestion: string | null = null;

  if (concentration > 0.6 && total >= totalTarget * 0.8) {
    const top = [...bySlot].sort((a, b) => b.grams - a.grams).slice(0, 2);
    const low = [...bySlot].sort((a, b) => a.grams - b.grams)[0];
    message = `Tu proteína diaria está bien, pero está bastante concentrada en ${top.map((t) => t.slot).join(' y ')}.`;
    suggestion = `Si te encaja, podrías mover 10-15 g hacia ${low.slot}. No es obligatorio: el total del día es lo que más pesa.`;
  } else if (effectiveDoses <= 1 && total >= 80) {
    message = 'Casi toda tu proteína entra en una sola comida.';
    suggestion = 'Reparto en 3-4 tomas de 25-40 g suele ser algo más eficiente, pero sin agobios.';
  }

  return { bySlot, concentration, effectiveDoses, message, suggestion };
}
