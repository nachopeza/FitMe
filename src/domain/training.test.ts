import { describe, expect, it } from 'vitest';
import {
  FOCUS_OPTIONS, TRAINING_KIND_LABEL, describeSession, metFor, normalizeSession,
  sessionExtraKcal, sessionKcal, trainingDemand, usesDistance, usesSetsAndReps,
} from './training';
import type { TrainingIntensity, TrainingKind, TrainingSession } from './types';

const KG = 66.5;

function session(over: Partial<TrainingSession> = {}): TrainingSession {
  return { kind: 'strength', intensity: 'moderate', focus: 'Pecho', minutes: 55, exercises: [], ...over };
}

describe('compatibilidad con sesiones antiguas', () => {
  it('rellena tipo e intensidad en las sesiones guardadas antes de existir esos campos', () => {
    // Así se guardaban las sesiones en la primera versión de la app.
    const antigua = { focus: 'Pecho', minutes: 55, exercises: [] } as TrainingSession;
    const n = normalizeSession(antigua);
    expect(n.kind).toBe('strength');
    expect(n.intensity).toBe('moderate');
    // Y siguen dando un coste razonable en lugar de fallar.
    expect(sessionKcal(KG, antigua)).toBeGreaterThan(0);
  });
});

describe('coste por tipo de entrenamiento', () => {
  it('los intervalos cuestan más que la fuerza a igual duración', () => {
    const fuerza = sessionKcal(KG, session({ kind: 'strength' }));
    const cardio = sessionKcal(KG, session({ kind: 'cardio' }));
    const hiit = sessionKcal(KG, session({ kind: 'hiit' }));
    const movilidad = sessionKcal(KG, session({ kind: 'mobility' }));
    expect(movilidad).toBeLessThan(fuerza);
    expect(fuerza).toBeLessThan(cardio);
    expect(cardio).toBeLessThan(hiit);
  });

  it('la intensidad sube el coste dentro del mismo tipo', () => {
    const kcal = (i: TrainingIntensity) => sessionKcal(KG, session({ intensity: i }));
    expect(kcal('easy')).toBeLessThan(kcal('moderate'));
    expect(kcal('moderate')).toBeLessThan(kcal('hard'));
  });

  it('mantiene los valores en un rango defendible', () => {
    // 55 min de fuerza a intensidad media, a 66,5 kg: ~320 kcal.
    expect(sessionKcal(KG, session())).toBeGreaterThan(250);
    expect(sessionKcal(KG, session())).toBeLessThan(400);
    // 45 min de intervalos duros no deberían pasar de ~700 kcal.
    expect(sessionKcal(KG, session({ kind: 'hiit', intensity: 'hard', minutes: 45 }))).toBeLessThan(700);
  });

  it('todos los tipos e intensidades tienen un MET definido', () => {
    for (const kind of Object.keys(TRAINING_KIND_LABEL) as TrainingKind[]) {
      for (const intensity of ['easy', 'moderate', 'hard'] as TrainingIntensity[]) {
        const met = metFor(session({ kind, intensity }));
        expect(met, `${kind}/${intensity}`).toBeGreaterThan(1);
        expect(met, `${kind}/${intensity}`).toBeLessThan(15);
      }
    }
  });
});

describe('demanda de la sesión', () => {
  it('veinte minutos de movilidad no cuentan como entrenamiento', () => {
    expect(trainingDemand(session({ kind: 'mobility', minutes: 20, intensity: 'easy' }))).toBe('negligible');
  });
  it('una sesión de diez minutos no cuenta, sea del tipo que sea', () => {
    expect(trainingDemand(session({ kind: 'hiit', minutes: 10 }))).toBe('negligible');
  });
  it('una sesión de fuerza normal cuenta como normal', () => {
    expect(trainingDemand(session())).toBe('normal');
  });
  it('los intervalos largos y duros cuentan como alta demanda', () => {
    expect(trainingDemand(session({ kind: 'hiit', intensity: 'hard', minutes: 50 }))).toBe('high');
    expect(trainingDemand(session({ kind: 'cardio', intensity: 'hard', minutes: 75 }))).toBe('high');
  });
});

describe('energía extra sobre la sesión media', () => {
  it('no añade nada por la sesión habitual, que ya está en el objetivo', () => {
    expect(sessionExtraKcal(KG, session())).toBe(0);
  });

  it('añade energía por una sesión claramente más exigente', () => {
    const extra = sessionExtraKcal(KG, session({ kind: 'hiit', intensity: 'hard', minutes: 60 }));
    expect(extra).toBeGreaterThan(100);
    expect(extra).toBeLessThanOrEqual(300);
  });

  it('descuenta por una sesión más suave, pero con tope', () => {
    const extra = sessionExtraKcal(KG, session({ kind: 'mobility', intensity: 'easy', minutes: 30 }));
    expect(extra).toBeLessThan(0);
    expect(extra).toBeGreaterThanOrEqual(-120);
  });

  it('amortigua: nunca suma el gasto estimado al completo', () => {
    const s = session({ kind: 'cardio', intensity: 'hard', minutes: 90 });
    expect(sessionExtraKcal(KG, s)).toBeLessThan(sessionKcal(KG, s));
  });
});

describe('estructura del formulario', () => {
  it('series y repeticiones solo donde tienen sentido', () => {
    expect(usesSetsAndReps('strength')).toBe(true);
    expect(usesSetsAndReps('hiit')).toBe(true);
    expect(usesSetsAndReps('cardio')).toBe(false);
    expect(usesSetsAndReps('mobility')).toBe(false);
  });
  it('distancia solo en cardio y deporte', () => {
    expect(usesDistance('cardio')).toBe(true);
    expect(usesDistance('sport')).toBe(true);
    expect(usesDistance('strength')).toBe(false);
  });
  it('todos los tipos ofrecen al menos una opción de foco', () => {
    for (const kind of Object.keys(TRAINING_KIND_LABEL) as TrainingKind[]) {
      expect(FOCUS_OPTIONS[kind].length, kind).toBeGreaterThan(0);
    }
  });
  it('describe la sesión de forma legible', () => {
    expect(describeSession(session())).toBe('Fuerza · Pecho');
    expect(describeSession(session({ kind: 'cardio', focus: 'Correr' }))).toBe('Cardio · Correr');
  });
});
