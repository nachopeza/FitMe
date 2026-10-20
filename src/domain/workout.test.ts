import { describe, expect, it } from 'vitest';
import type { Workout, WorkoutExercise, WorkoutSet } from './types';
import {
  bestSet, describeSet, estimated1RM, exerciseVolume, formatSeconds, musclesWorked,
  nextSetTemplate, personalBest, previousPerformance, toTrainingSession, totalReps,
  muscleSets, totalSets, workingSets, workoutMinutes, workoutVolume,
} from './workout';

const set = (s: Partial<WorkoutSet>): WorkoutSet => ({ done: true, ...s });

const ex = (exerciseId: string, sets: WorkoutSet[], name = exerciseId): WorkoutExercise => ({
  uid: `u-${exerciseId}`, exerciseId, name, sets, restSeconds: 120,
});

const workout = (w: Partial<Workout>): Workout => ({
  id: 'w1', date: '2026-10-20', startedAt: 0, name: 'Sesión', exercises: [], ...w,
});

describe('series que cuentan', () => {
  const press = ex('press-banca', [
    set({ kg: 20, reps: 15, warmup: true }),
    set({ kg: 60, reps: 8 }),
    set({ kg: 60, reps: 7 }),
    { kg: 60, reps: 6, done: false },
  ]);

  it('deja fuera el calentamiento y lo no marcado', () => {
    expect(workingSets(press)).toHaveLength(2);
  });

  it('el volumen solo suma las series efectivas', () => {
    // 60×8 + 60×7 = 900. El calentamiento (300) y la serie sin marcar no entran.
    expect(exerciseVolume(press)).toBe(900);
  });

  it('cuenta series y repeticiones de la sesión entera', () => {
    const w = workout({ exercises: [press, ex('sentadilla', [set({ kg: 80, reps: 5 })])] });
    expect(totalSets(w)).toBe(3);
    expect(totalReps(w)).toBe(20);
    expect(workoutVolume(w)).toBe(900 + 400);
  });
});

describe('1RM estimada', () => {
  it('una repetición es ya la máxima', () => {
    expect(estimated1RM(set({ kg: 100, reps: 1 }))).toBe(100);
  });

  it('aplica Epley en el rango en que significa algo', () => {
    // 60 × (1 + 8/30) = 76 kg
    expect(estimated1RM(set({ kg: 60, reps: 8 }))).toBe(76);
  });

  it('por encima de 12 repeticiones no devuelve un número falso', () => {
    expect(estimated1RM(set({ kg: 40, reps: 20 }))).toBeNull();
  });

  it('sin peso o sin repeticiones tampoco inventa', () => {
    expect(estimated1RM(set({ reps: 8 }))).toBeNull();
    expect(estimated1RM(set({ kg: 60 }))).toBeNull();
  });

  it('la mejor serie es la de más 1RM, no la de más repeticiones', () => {
    const e = ex('press-banca', [set({ kg: 50, reps: 12 }), set({ kg: 70, reps: 6 })]);
    expect(bestSet(e)?.kg).toBe(70);
  });

  it('sin series efectivas no hay mejor serie', () => {
    expect(bestSet(ex('press-banca', [set({ kg: 20, reps: 10, warmup: true })]))).toBeNull();
  });
});

describe('cómo se lee una serie', () => {
  it('peso por repeticiones', () => {
    expect(describeSet(set({ kg: 60, reps: 8 }), 'weightReps')).toBe('60 kg × 8');
  });

  it('peso corporal: solo repeticiones', () => {
    expect(describeSet(set({ reps: 12 }), 'bodyweightReps')).toBe('12 reps');
  });

  it('peso corporal lastrado: el peso se suma', () => {
    expect(describeSet(set({ kg: 10, reps: 6 }), 'weightedBodyweight')).toBe('+10 kg × 6');
    expect(describeSet(set({ reps: 6 }), 'weightedBodyweight')).toBe('6 reps');
  });

  it('tiempo y distancia', () => {
    expect(describeSet(set({ seconds: 90 }), 'time')).toBe('1:30');
    expect(describeSet(set({ km: 5, seconds: 1500 }), 'distance')).toBe('5 km · 25:00');
    expect(describeSet(set({}), 'distance')).toBe('—');
  });

  it('formatea segundos con dos cifras', () => {
    expect(formatSeconds(65)).toBe('1:05');
    expect(formatSeconds(0)).toBe('0:00');
  });
});

describe('duración', () => {
  it('redondea a minutos contra el final real', () => {
    expect(workoutMinutes(workout({ startedAt: 0, finishedAt: 45 * 60_000 }))).toBe(45);
  });

  it('una sesión abierta se mide contra ahora', () => {
    expect(workoutMinutes(workout({ startedAt: 0 }), 10 * 60_000)).toBe(10);
  });

  it('nunca baja de un minuto: una sesión guardada ocupó algo', () => {
    expect(workoutMinutes(workout({ startedAt: 0, finishedAt: 20_000 }))).toBe(1);
  });
});

describe('referencia de la sesión anterior', () => {
  const hoy = workout({ id: 'hoy', startedAt: 300, exercises: [ex('press-banca', [set({ kg: 65, reps: 8 })])] });
  const ayer = workout({
    id: 'ayer', date: '2026-10-19', startedAt: 100, finishedAt: 200,
    exercises: [ex('press-banca', [set({ kg: 60, reps: 8 })])],
  });
  const antes = workout({
    id: 'antes', date: '2026-10-12', startedAt: 10, finishedAt: 20,
    exercises: [ex('press-banca', [set({ kg: 55, reps: 8 })])],
  });
  const abierta = workout({ id: 'abierta', startedAt: 900, exercises: [ex('press-banca', [set({ kg: 90, reps: 8 })])] });

  it('coge la última sesión terminada, no la actual', () => {
    const prev = previousPerformance('press-banca', [antes, ayer, hoy], 'hoy');
    expect(prev?.sets[0].kg).toBe(60);
  });

  it('ignora sesiones sin terminar', () => {
    const prev = previousPerformance('press-banca', [ayer, abierta], 'hoy');
    expect(prev?.sets[0].kg).toBe(60);
  });

  it('si el ejercicio es nuevo, no hay referencia', () => {
    expect(previousPerformance('peso-muerto', [ayer, antes])).toBeNull();
  });

  it('el récord histórico sale de la mejor serie de cualquier día', () => {
    const pb = personalBest('press-banca', [antes, ayer]);
    expect(pb?.set.kg).toBe(60);
    expect(pb?.date).toBe('2026-10-19');
  });
});

describe('puente con la parte nutricional', () => {
  it('clasifica como fuerza y nombra los músculos más trabajados', () => {
    const w = workout({
      startedAt: 0, finishedAt: 50 * 60_000,
      exercises: [
        ex('press-banca', [set({ kg: 60, reps: 8 }), set({ kg: 60, reps: 8 }), set({ kg: 60, reps: 7 })]),
        ex('sentadilla', [set({ kg: 90, reps: 5 })]),
      ],
    });
    const s = toTrainingSession(w);
    expect(s.kind).toBe('strength');
    expect(s.focus).toContain('Pecho');
    expect(s.minutes).toBe(50);
  });

  it('una sesión solo de máquinas de cardio se clasifica como cardio', () => {
    const w = workout({
      startedAt: 0, finishedAt: 30 * 60_000,
      exercises: [ex('cinta', [set({ km: 5, seconds: 1800 })])],
    });
    expect(toTrainingSession(w).kind).toBe('cardio');
  });

  it('una sesión vacía no es cardio: sin ejercicios no se afirma nada', () => {
    const w = workout({ startedAt: 0, finishedAt: 10 * 60_000 });
    expect(toTrainingSession(w).kind).toBe('strength');
  });

  it('la intensidad sale de la densidad de series', () => {
    const densa = workout({
      startedAt: 0, finishedAt: 40 * 60_000,
      exercises: [ex('press-banca', Array.from({ length: 20 }, () => set({ kg: 60, reps: 8 })))],
    });
    const suave = workout({
      startedAt: 0, finishedAt: 70 * 60_000,
      exercises: [ex('press-banca', Array.from({ length: 10 }, () => set({ kg: 60, reps: 8 })))],
    });
    expect(toTrainingSession(densa).intensity).toBe('hard');
    expect(toTrainingSession(suave).intensity).toBe('easy');
  });

  it('el calentamiento no infla la intensidad', () => {
    const w = workout({
      startedAt: 0, finishedAt: 40 * 60_000,
      exercises: [ex('press-banca', [
        ...Array.from({ length: 16 }, () => set({ kg: 20, reps: 10, warmup: true })),
        set({ kg: 60, reps: 8 }),
      ])],
    });
    expect(toTrainingSession(w).intensity).toBe('easy');
  });

  it('cuenta las series por músculo, de más a menos', () => {
    const w = workout({
      exercises: [
        ex('sentadilla', [set({ kg: 90, reps: 5 })]),
        ex('press-banca', [set({ kg: 60, reps: 8 }), set({ kg: 60, reps: 8 })]),
      ],
    });
    const m = musclesWorked(w);
    expect(m[0].sets).toBe(2);
    expect(m).toHaveLength(2);
  });
});

describe('siguiente serie', () => {
  it('copia la última con datos y la deja sin marcar', () => {
    const e = ex('press-banca', [set({ kg: 60, reps: 8 }), set({ kg: 62.5, reps: 6 })]);
    expect(nextSetTemplate(e)).toEqual({ kg: 62.5, reps: 6, seconds: undefined, km: undefined, done: false });
  });

  it('en un ejercicio recién añadido empieza en blanco', () => {
    expect(nextSetTemplate(ex('press-banca', []))).toEqual({ done: false });
  });
});

describe('mapa de músculos', () => {
  it('cuenta las series del músculo principal', () => {
    const w = workout({ exercises: [ex('press-banca', [set({ kg: 60, reps: 8 }), set({ kg: 60, reps: 8 })])] });
    expect(muscleSets([w]).get('chest')).toBe(2);
  });

  it('los secundarios cuentan a mitad', () => {
    const w = workout({ exercises: [ex('press-banca', [set({ kg: 60, reps: 8 }), set({ kg: 60, reps: 8 })])] });
    const m = muscleSets([w]);
    // El press de banca lleva hombro y tríceps como secundarios.
    expect(m.get('triceps')).toBe(1);
    expect(m.get('shoulders')).toBe(1);
  });

  it('suma varias sesiones', () => {
    const a = workout({ id: 'a', exercises: [ex('sentadilla', [set({ kg: 90, reps: 5 })])] });
    const b = workout({ id: 'b', exercises: [ex('sentadilla', [set({ kg: 95, reps: 5 })])] });
    expect(muscleSets([a, b]).get('quads')).toBe(2);
  });

  it('el calentamiento no cuenta', () => {
    const w = workout({ exercises: [ex('press-banca', [set({ kg: 20, reps: 12, warmup: true })])] });
    expect(muscleSets([w]).has('chest')).toBe(false);
  });
});
