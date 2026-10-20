import { describe, expect, it } from 'vitest';
import { foodsToRefresh } from './db';
import { SEED_FOODS } from './foods';
import type { Food } from '../domain/types';

const food = (id: string, extra: Partial<Food> = {}): Food => ({
  id,
  name: id,
  aliases: [],
  state: 'asIs',
  category: 'other',
  proteinSource: 'none',
  per100g: { kcal: 100, protein: 5, carbs: 10, fat: 3, fiber: 1 },
  unit: 'g',
  portions: [],
  ...extra,
});

describe('actualizar el catálogo sin pisar lo del usuario', () => {
  const seed = [food('arroz'), food('platano'), food('pechuga')];

  it('refresca los que él no ha tocado', () => {
    const ids = foodsToRefresh(seed, [food('arroz')]).map((f) => f.id);
    expect(ids).toEqual(['arroz', 'platano', 'pechuga']);
  });

  it('respeta un alimento del catálogo que él ha corregido', () => {
    const ids = foodsToRefresh(seed, [food('arroz', { edited: true })]).map((f) => f.id);
    expect(ids).not.toContain('arroz');
    expect(ids).toEqual(['platano', 'pechuga']);
  });

  it('respeta los suyos propios aunque coincida el id', () => {
    const ids = foodsToRefresh(seed, [food('platano', { custom: true })]).map((f) => f.id);
    expect(ids).not.toContain('platano');
  });

  it('con la base vacía entra el catálogo entero', () => {
    expect(foodsToRefresh(SEED_FOODS, [])).toHaveLength(SEED_FOODS.length);
  });

  it('si lo ha corregido todo, no se toca nada', () => {
    const stored = seed.map((f) => ({ ...f, edited: true }));
    expect(foodsToRefresh(seed, stored)).toEqual([]);
  });
});
