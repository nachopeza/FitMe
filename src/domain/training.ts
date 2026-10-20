import type { TrainingIntensity, TrainingKind, TrainingSession } from './types';

/**
 * Clasificación de entrenamientos y su coste energético.
 *
 * Por qué existe: una sesión de fuerza de 55 minutos con descansos y una de
 * intervalos de 55 minutos no cuestan ni parecido. Tratarlas igual —como hacía
 * la primera versión, que asumía fuerza siempre— falsea el gasto del día y, con
 * él, el ajuste de las calorías.
 *
 * Los valores son MET (múltiplos del metabolismo en reposo) del Compendium of
 * Physical Activities. Se han elegido deliberadamente por el extremo bajo de
 * cada rango: sobreestimar el gasto del entrenamiento es el error clásico, y
 * lleva a comer de más pensando que se está compensando.
 */

export const TRAINING_KIND_LABEL: Record<TrainingKind, string> = {
  strength: 'Fuerza',
  cardio: 'Cardio',
  hiit: 'HIIT / intervalos',
  mobility: 'Movilidad',
  sport: 'Deporte',
  other: 'Otro',
};

export const TRAINING_KIND_HINT: Record<TrainingKind, string> = {
  strength: 'Pesas, dominadas, calistenia con series y descansos',
  cardio: 'Correr, bici, elíptica, caminar rápido a ritmo sostenido',
  hiit: 'Intervalos, circuitos, metabólico, cuerda',
  mobility: 'Estiramientos, movilidad, yoga suave',
  sport: 'Fútbol, pádel, baloncesto, natación',
  other: 'Cualquier otra cosa',
};

export const TRAINING_INTENSITY_LABEL: Record<TrainingIntensity, string> = {
  easy: 'Suave',
  moderate: 'Media',
  hard: 'Alta',
};

export const TRAINING_INTENSITY_HINT: Record<TrainingIntensity, string> = {
  easy: 'Podría haber seguido bastante más',
  moderate: 'Me ha costado, pero controlado',
  hard: 'Al límite o cerca',
};

/** Opciones de foco según el tipo. La primera es la sugerida. */
export const FOCUS_OPTIONS: Record<TrainingKind, string[]> = {
  strength: ['Pecho', 'Espalda', 'Hombro', 'Brazo', 'Pierna', 'Empuje', 'Tirón', 'Torso', 'Cuerpo completo', 'Core'],
  cardio: ['Correr', 'Bici', 'Elíptica', 'Remo', 'Caminar', 'Natación', 'Cinta'],
  hiit: ['Circuito', 'Intervalos', 'Metabólico', 'Cuerda', 'Sprints'],
  mobility: ['Movilidad general', 'Estiramientos', 'Yoga', 'Cadera', 'Hombro', 'Espalda'],
  sport: ['Fútbol', 'Pádel', 'Tenis', 'Baloncesto', 'Natación', 'Escalada', 'Otro deporte'],
  other: ['Entrenamiento'],
};

/** Los tipos que se registran ejercicio a ejercicio con series y repeticiones. */
export function usesSetsAndReps(kind: TrainingKind): boolean {
  return kind === 'strength' || kind === 'hiit' || kind === 'other';
}

/** Los tipos donde tiene sentido apuntar distancia. */
export function usesDistance(kind: TrainingKind): boolean {
  return kind === 'cardio' || kind === 'sport';
}

const MET: Record<TrainingKind, Record<TrainingIntensity, number>> = {
  strength: { easy: 3.5, moderate: 5, hard: 6.5 },
  cardio: { easy: 5, moderate: 7.5, hard: 10 },
  hiit: { easy: 7, moderate: 9.5, hard: 12 },
  mobility: { easy: 2.3, moderate: 2.8, hard: 3.5 },
  sport: { easy: 5, moderate: 7, hard: 9 },
  other: { easy: 3.5, moderate: 5, hard: 6.5 },
};

/** Rellena los campos que no existían en versiones anteriores de la app. */
export function normalizeSession(s: TrainingSession): Required<Pick<TrainingSession, 'kind' | 'intensity'>> & TrainingSession {
  return { ...s, kind: s.kind ?? 'strength', intensity: s.intensity ?? 'moderate' };
}

export function metFor(session: TrainingSession): number {
  const n = normalizeSession(session);
  return MET[n.kind][n.intensity];
}

/**
 * Coste estimado de la sesión. kcal/min = MET × 3,5 × kg / 200.
 * Es una estimación con un margen amplio, y la interfaz lo dice.
 */
export function sessionKcal(weightKg: number, session: TrainingSession): number {
  return (metFor(session) * 3.5 * weightKg * session.minutes) / 200;
}

/** Cuánta demanda supone la sesión, para clasificar el día. */
export type TrainingDemand = 'negligible' | 'normal' | 'high';

export function trainingDemand(session: TrainingSession): TrainingDemand {
  const n = normalizeSession(session);
  // Veinte minutos de movilidad no convierten el día en un día de entreno.
  if (n.kind === 'mobility' && n.minutes < 45) return 'negligible';
  if (n.minutes < 15) return 'negligible';
  const kcalPerKg = (metFor(session) * 3.5 * n.minutes) / 200;
  // Por encima de ~7 kcal/kg (unas 470 kcal a 67 kg) el día pide más energía.
  if (kcalPerKg >= 7) return 'high';
  return 'normal';
}

/**
 * Energía adicional que merece el día por encima de lo que ya asume el objetivo.
 *
 * El objetivo diario ya incluye el promedio de las sesiones habituales del
 * usuario. Así que aquí solo se suma la DIFERENCIA entre la sesión de hoy y esa
 * sesión media, y amortiguada al 60%: las estimaciones de gasto tienen mucho
 * margen y no conviene comer sobre ellas al 100%.
 */
export function sessionExtraKcal(
  weightKg: number,
  session: TrainingSession,
  /** Minutos de la sesión típica del usuario, la que ya está en el objetivo. */
  baselineMinutes = 55,
): number {
  const baseline: TrainingSession = {
    kind: 'strength',
    intensity: 'moderate',
    focus: '',
    minutes: baselineMinutes,
    exercises: [],
  };
  const diff = sessionKcal(weightKg, session) - sessionKcal(weightKg, baseline);
  const damped = diff * 0.6;
  // Límites: ni un extra desmedido ni un recorte por entrenar suave.
  return Math.round(Math.max(-120, Math.min(300, damped)) / 10) * 10;
}

/** Resumen legible de la sesión, para las tarjetas y el histórico. */
export function describeSession(session: TrainingSession): string {
  const n = normalizeSession(session);
  const parts = [TRAINING_KIND_LABEL[n.kind]];
  if (n.focus) parts.push(n.focus);
  return parts.join(' · ');
}
