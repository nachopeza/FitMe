import { EXERCISES_BY_ID } from '../data/exercises';
import type {
  Exercise, TrainingIntensity, TrainingSession, Workout, WorkoutExercise, WorkoutSet,
} from './types';
import { MUSCLE_LABEL } from '../data/exercises';

/**
 * Lógica de las sesiones de entrenamiento con series.
 *
 * El registro de entreno y el de comida comparten un puente: al cerrar una
 * sesión se deriva de ella un `TrainingSession`, que es lo que la parte
 * nutricional usa para clasificar el día y estimar el gasto. Así no hay dos
 * verdades sobre si hoy se entrenó.
 */

/** Series que cuentan: las de calentamiento no entran en volumen ni en récords. */
export function workingSets(ex: WorkoutExercise): WorkoutSet[] {
  return ex.sets.filter((s) => s.done && !s.warmup);
}

/** Volumen de un ejercicio: kilos movidos por repetición. */
export function exerciseVolume(ex: WorkoutExercise): number {
  return workingSets(ex).reduce((a, s) => a + (s.kg ?? 0) * (s.reps ?? 0), 0);
}

export function workoutVolume(w: Workout): number {
  return w.exercises.reduce((a, ex) => a + exerciseVolume(ex), 0);
}

export function totalSets(w: Workout): number {
  return w.exercises.reduce((a, ex) => a + workingSets(ex).length, 0);
}

export function totalReps(w: Workout): number {
  return w.exercises.reduce((a, ex) => a + workingSets(ex).reduce((b, s) => b + (s.reps ?? 0), 0), 0);
}

/**
 * Estimación de una repetición máxima por la fórmula de Epley.
 *
 * Solo tiene sentido hasta unas 12 repeticiones; por encima se dispara y deja
 * de significar nada, así que se devuelve null en lugar de un número falso.
 */
export function estimated1RM(set: WorkoutSet): number | null {
  if (!set.kg || !set.reps || set.reps < 1 || set.reps > 12) return null;
  if (set.reps === 1) return set.kg;
  return Math.round(set.kg * (1 + set.reps / 30) * 10) / 10;
}

/** La serie más fuerte del ejercicio, por 1RM estimada y, si no, por volumen. */
export function bestSet(ex: WorkoutExercise): WorkoutSet | null {
  const sets = workingSets(ex);
  if (!sets.length) return null;
  return sets.reduce((best, s) => {
    const a = estimated1RM(s) ?? (s.kg ?? 0) * (s.reps ?? 0);
    const b = estimated1RM(best) ?? (best.kg ?? 0) * (best.reps ?? 0);
    return a > b ? s : best;
  });
}

/** Texto corto de una serie: "60 kg × 8", "12 reps", "1:30". */
export function describeSet(set: WorkoutSet, kind: Exercise['kind']): string {
  if (kind === 'time') return formatSeconds(set.seconds ?? 0);
  if (kind === 'distance') {
    const bits: string[] = [];
    if (set.km) bits.push(`${set.km} km`);
    if (set.seconds) bits.push(formatSeconds(set.seconds));
    return bits.join(' · ') || '—';
  }
  if (kind === 'bodyweightReps') return `${set.reps ?? 0} reps`;
  if (kind === 'weightedBodyweight') {
    return set.kg ? `+${set.kg} kg × ${set.reps ?? 0}` : `${set.reps ?? 0} reps`;
  }
  return `${set.kg ?? 0} kg × ${set.reps ?? 0}`;
}

export function formatSeconds(total: number): string {
  const m = Math.floor(total / 60);
  const s = Math.round(total % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

/** Duración de la sesión en minutos. */
export function workoutMinutes(w: Workout, now = Date.now()): number {
  const end = w.finishedAt ?? now;
  return Math.max(1, Math.round((end - w.startedAt) / 60000));
}

/**
 * La sesión anterior de un ejercicio, para enseñarla como referencia mientras se
 * entrena. Es lo que permite saber si hoy hay que subir el peso.
 */
export function previousPerformance(
  exerciseId: string,
  history: Workout[],
  /** Sesión actual, que se excluye de la búsqueda. */
  currentId?: string,
): WorkoutExercise | null {
  const past = history
    .filter((w) => w.id !== currentId && w.finishedAt)
    .sort((a, b) => (b.finishedAt ?? 0) - (a.finishedAt ?? 0));
  for (const w of past) {
    const ex = w.exercises.find((e) => e.exerciseId === exerciseId && workingSets(e).length > 0);
    if (ex) return ex;
  }
  return null;
}

/** Mejor marca histórica de un ejercicio. */
export function personalBest(exerciseId: string, history: Workout[]): { set: WorkoutSet; date: string } | null {
  let best: { set: WorkoutSet; date: string } | null = null;
  for (const w of history) {
    if (!w.finishedAt) continue;
    for (const ex of w.exercises) {
      if (ex.exerciseId !== exerciseId) continue;
      const candidate = bestSet(ex);
      if (!candidate) continue;
      const score = estimated1RM(candidate) ?? (candidate.kg ?? 0) * (candidate.reps ?? 0);
      const current = best ? (estimated1RM(best.set) ?? (best.set.kg ?? 0) * (best.set.reps ?? 0)) : -1;
      if (score > current) best = { set: candidate, date: w.date };
    }
  }
  return best;
}

/** Grupos musculares trabajados, de más series a menos. */
export function musclesWorked(w: Workout): { muscle: string; sets: number }[] {
  const counts = new Map<string, number>();
  for (const ex of w.exercises) {
    const def = EXERCISES_BY_ID.get(ex.exerciseId);
    if (!def) continue;
    const n = workingSets(ex).length;
    if (!n) continue;
    counts.set(def.muscle, (counts.get(def.muscle) ?? 0) + n);
  }
  return [...counts.entries()]
    .map(([muscle, sets]) => ({ muscle: MUSCLE_LABEL[muscle as keyof typeof MUSCLE_LABEL] ?? muscle, sets }))
    .sort((a, b) => b.sets - a.sets);
}

/**
 * Deriva de la sesión los datos que necesita la parte nutricional.
 *
 * La intensidad sale de la densidad de la sesión: series efectivas por minuto.
 * Un entreno de 20 series en 45 minutos es intenso; 10 series en 70 minutos, no.
 */
export function toTrainingSession(w: Workout, now = Date.now()): TrainingSession {
  const minutes = workoutMinutes(w, now);
  const sets = totalSets(w);
  const perMinute = sets / minutes;
  const intensity: TrainingIntensity = perMinute >= 0.4 ? 'hard' : perMinute >= 0.22 ? 'moderate' : 'easy';

  const muscles = musclesWorked(w);
  // Con `every` a secas, una sesión sin ejercicios saldría clasificada como
  // cardio; hace falta al menos un ejercicio para poder afirmar nada.
  const isCardio = w.exercises.length > 0 && w.exercises.every((ex) => {
    const def = EXERCISES_BY_ID.get(ex.exerciseId);
    return def?.muscle === 'cardio';
  });

  return {
    kind: isCardio ? 'cardio' : 'strength',
    focus: muscles.length ? muscles.slice(0, 2).map((m) => m.muscle).join(' y ') : w.name,
    minutes,
    intensity,
    // Se reutiliza la lista de ejercicios en el formato antiguo, para que el
    // histórico siga siendo legible desde la parte nutricional.
    exercises: w.exercises.map((ex) => {
      const done = workingSets(ex);
      const top = bestSet(ex);
      return {
        exercise: ex.name,
        sets: done.length,
        reps: done.length ? String(done[0].reps ?? '—') : '—',
        weightKg: top?.kg,
      };
    }),
    location: 'gym',
  };
}

/**
 * Descanso real entre series, en segundos.
 *
 * Sale de cuándo se marcó cada serie, no del descanso sugerido. Los huecos
 * enormes se descartan: si alguien deja la sesión abierta y vuelve media hora
 * después, eso no fue un descanso entre series.
 */
export function restGaps(w: Workout, maxGapSeconds = 600): number[] {
  const stamps = w.exercises
    .flatMap((ex) => ex.sets.filter((s) => s.done && !s.warmup && s.completedAt))
    .map((s) => s.completedAt as number)
    .sort((a, b) => a - b);
  const gaps: number[] = [];
  for (let i = 1; i < stamps.length; i++) {
    const gap = Math.round((stamps[i] - stamps[i - 1]) / 1000);
    if (gap > 0 && gap <= maxGapSeconds) gaps.push(gap);
  }
  return gaps;
}

/** Descanso medio real, o null si todavía no hay dos series marcadas. */
export function averageRest(w: Workout): number | null {
  const gaps = restGaps(w);
  if (!gaps.length) return null;
  return Math.round(gaps.reduce((a, b) => a + b, 0) / gaps.length);
}

/** Siguiente serie sugerida, copiando la anterior: es lo que se repite. */
export function nextSetTemplate(ex: WorkoutExercise): WorkoutSet {
  const last = [...ex.sets].reverse().find((s) => s.kg != null || s.reps != null || s.seconds != null);
  if (!last) return { done: false };
  return { kg: last.kg, reps: last.reps, seconds: last.seconds, km: last.km, done: false };
}
