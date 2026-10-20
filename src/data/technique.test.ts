import { describe, expect, it } from 'vitest';
import { EXERCISES, EXERCISES_BY_ID } from './exercises';
import { TECHNIQUE, WITH_PHOTOS } from './technique';

describe('técnica de los ejercicios', () => {
  it('todos los ejercicios del catálogo explican cómo se hacen', () => {
    const sin = EXERCISES.filter((e) => !TECHNIQUE[e.id]).map((e) => e.id);
    expect(sin).toEqual([]);
  });

  it('no sobra técnica de ejercicios que no existen', () => {
    const sobra = Object.keys(TECHNIQUE).filter((id) => !EXERCISES_BY_ID.has(id));
    expect(sobra).toEqual([]);
  });

  it('cada ejercicio con foto está en el catálogo', () => {
    const sobra = [...WITH_PHOTOS].filter((id) => !EXERCISES_BY_ID.has(id));
    expect(sobra).toEqual([]);
  });

  it('cada explicación da al menos dos claves y ninguna vacía', () => {
    for (const [id, t] of Object.entries(TECHNIQUE)) {
      expect(t.cues.length, id).toBeGreaterThanOrEqual(2);
      for (const c of t.cues) expect(c.trim().length, id).toBeGreaterThan(10);
    }
  });
});
