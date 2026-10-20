import { describe, expect, it } from 'vitest';
import { eatenBySlot, mealBehind, mealTargets } from './meals';
import type { MealSlot, Nutrients } from './types';

const n = (kcal: number, protein = 0): Nutrients => ({
  kcal, protein, carbs: 0, fat: 0, fiber: 0,
});

describe('reparto del día entre comidas', () => {
  it('reparte la energía y suma el objetivo del día', () => {
    const t = mealTargets(2430, 133);
    expect(t.map((x) => x.slot)).toEqual(['breakfast', 'lunch', 'snack', 'dinner']);
    const total = t.reduce((a, x) => a + x.kcal, 0);
    expect(Math.abs(total - 2430)).toBeLessThanOrEqual(2);
  });

  it('la comida principal es la que más lleva y la merienda la que menos', () => {
    const t = mealTargets(2430, 133);
    const by = Object.fromEntries(t.map((x) => [x.slot, x.kcal]));
    expect(by.lunch).toBeGreaterThan(by.breakfast);
    expect(by.snack).toBeLessThan(by.breakfast);
  });

  it('la proteína se reparte a partes iguales, no en proporción a las kcal', () => {
    const t = mealTargets(2430, 132);
    expect(t.every((x) => x.protein === 33)).toBe(true);
  });

  it('si no merienda, su parte se reparte entre las demás', () => {
    const sin = mealTargets(2430, 133, ['breakfast', 'lunch', 'dinner']);
    expect(sin).toHaveLength(3);
    expect(Math.abs(sin.reduce((a, x) => a + x.kcal, 0) - 2430)).toBeLessThanOrEqual(2);
    const conMerienda = mealTargets(2430, 133);
    const desayunoCon = conMerienda.find((x) => x.slot === 'breakfast')!.kcal;
    expect(sin.find((x) => x.slot === 'breakfast')!.kcal).toBeGreaterThan(desayunoCon);
  });

  it('sin franjas no inventa comidas', () => {
    expect(mealTargets(2430, 133, [])).toEqual([]);
  });
});

describe('lo comido en cada franja', () => {
  it('agrupa y suma', () => {
    const map = eatenBySlot([
      { slot: 'breakfast', nutrients: n(300, 12) },
      { slot: 'breakfast', nutrients: n(200, 8) },
      { slot: 'dinner', nutrients: n(600, 40) },
    ]);
    expect(map.get('breakfast')?.kcal).toBe(500);
    expect(map.get('breakfast')?.protein).toBe(20);
    expect(map.get('dinner')?.kcal).toBe(600);
    expect(map.has('lunch')).toBe(false);
  });
});

describe('en qué comida se está quedando corto', () => {
  const targets = mealTargets(2430, 133);
  const times: Partial<Record<MealSlot, string>> = {
    breakfast: '09:00', lunch: '14:00', snack: '18:00', dinner: '21:00',
  };

  it('señala la franja ya pasada con menos cubierto', () => {
    const eaten = eatenBySlot([
      { slot: 'breakfast', nutrients: n(120) },
      { slot: 'lunch', nutrients: n(700) },
    ]);
    expect(mealBehind(targets, eaten, times, '15:00')).toBe('breakfast');
  });

  it('no señala una comida que todavía no toca', () => {
    const eaten = eatenBySlot([{ slot: 'breakfast', nutrients: n(600) }]);
    expect(mealBehind(targets, eaten, times, '10:00')).toBeNull();
  });

  it('una comida casi cubierta no se señala', () => {
    const desayuno = targets.find((t) => t.slot === 'breakfast')!;
    const eaten = eatenBySlot([{ slot: 'breakfast', nutrients: n(desayuno.kcal * 0.9) }]);
    expect(mealBehind(targets, eaten, times, '12:00')).toBeNull();
  });

  it('con el día entero por delante y nada comido, señala el desayuno', () => {
    expect(mealBehind(targets, new Map(), times, '22:00')).toBe('breakfast');
  });
});
