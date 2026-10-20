import { describe, expect, it } from 'vitest';
import { behindMacro, closeTheGap, dominantMacro, loggingStreak } from './motivation';
import type { Nutrients } from './types';

const n = (p: number, c: number, f: number): Nutrients => ({
  kcal: p * 4 + c * 4 + f * 9, protein: p, carbs: c, fat: f, fiber: 0, sugars: 0, satFat: 0,
});

describe('qué macro va más atrasado', () => {
  const target = { protein: 133, carbs: 357, fat: 72 };

  it('señala el que menos proporción lleva', () => {
    expect(behindMacro({ protein: 30, carbs: 300, fat: 60 }, target)).toBe('protein');
    expect(behindMacro({ protein: 120, carbs: 60, fat: 60 }, target)).toBe('carbs');
    expect(behindMacro({ protein: 120, carbs: 330, fat: 10 }, target)).toBe('fat');
  });

  it('a día vacío, la proteína manda', () => {
    expect(behindMacro({ protein: 0, carbs: 0, fat: 0 }, target)).toBe('protein');
  });
});

describe('de qué va un alimento', () => {
  it('reconoce el que domina', () => {
    expect(dominantMacro(n(25, 2, 2))).toBe('protein');
    expect(dominantMacro(n(1, 27, 0))).toBe('carbs');
    expect(dominantMacro(n(6, 6, 50))).toBe('fat');
  });

  it('no tiñe lo que está repartido', () => {
    expect(dominantMacro(n(10, 20, 8))).toBeNull();
  });

  it('no tiñe lo que casi no aporta nada, como un café solo', () => {
    expect(dominantMacro(n(0.2, 0, 0))).toBeNull();
  });
});

describe('cómo cerrar el hueco con su propia comida', () => {
  const batido = { id: 'b', name: 'Batido de proteína', kcal: 240, protein: 32 };
  const platano = { id: 'p', name: 'Plátano', kcal: 105, protein: 1.3 };
  const nueces = { id: 'n', name: 'Puñado de nueces', kcal: 200, protein: 4.6 };

  it('con proteína pendiente, propone antes lo proteico', () => {
    const plan = closeTheGap(700, 80, [batido, platano, nueces]);
    expect(plan.find((p) => p.id === 'b')?.count).toBeGreaterThanOrEqual(2);
  });

  it('cubre la mayor parte del hueco sin pasarse mucho', () => {
    const plan = closeTheGap(700, 80, [batido, platano, nueces]);
    const total = plan.reduce((a, p) => a + p.kcal * p.count, 0);
    expect(total).toBeGreaterThan(700 * 0.7);
    expect(total).toBeLessThan(700 * 1.25);
  });

  it('con la proteína ya cubierta, va a por energía', () => {
    const plan = closeTheGap(500, 0, [batido, platano, nueces]);
    expect(plan.length).toBeGreaterThan(0);
    expect(plan.reduce((a, p) => a + p.kcal * p.count, 0)).toBeGreaterThan(300);
  });

  it('no propone nada si apenas falta', () => {
    expect(closeTheGap(40, 2, [batido, platano])).toEqual([]);
  });

  it('no propone nada si no hay de dónde elegir', () => {
    expect(closeTheGap(900, 60, [])).toEqual([]);
  });

  it('no repite el mismo alimento sin fin ni mezcla demasiados', () => {
    const plan = closeTheGap(3000, 200, [batido, platano, nueces]);
    expect(plan.length).toBeLessThanOrEqual(3);
    for (const p of plan) expect(p.count).toBeLessThanOrEqual(3);
  });
});

describe('racha de registro', () => {
  it('cuenta los días seguidos hasta hoy', () => {
    expect(loggingStreak(['2026-10-18', '2026-10-19', '2026-10-20'], '2026-10-20')).toBe(3);
  });

  it('hoy sin registrar todavía no rompe la racha', () => {
    expect(loggingStreak(['2026-10-18', '2026-10-19'], '2026-10-20')).toBe(2);
  });

  it('un hueco de verdad la corta', () => {
    expect(loggingStreak(['2026-10-15', '2026-10-16', '2026-10-19'], '2026-10-20')).toBe(1);
  });

  it('sin nada registrado, no hay racha', () => {
    expect(loggingStreak([], '2026-10-20')).toBe(0);
  });

  it('cruza el cambio de mes', () => {
    expect(loggingStreak(['2026-09-29', '2026-09-30', '2026-10-01'], '2026-10-01')).toBe(3);
  });
});
