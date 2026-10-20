import { describe, expect, it } from 'vitest';
import { quickAddItems, slotFromHour } from './quickAdd';
import { EMPTY_NUTRIENTS, type MealSlot, type SavedMeal } from '../domain/types';

function meal(over: Partial<SavedMeal> & { name: string }): SavedMeal {
  return {
    id: over.name,
    items: [],
    prepMinutes: 10,
    useCount: 0,
    createdAt: 0,
    ...over,
  };
}

const macrosOf = () => ({ kcal: 400, protein: 30, carbs: 40, fat: 11, fiber: 3 });

function run(savedMeals: SavedMeal[], slot: MealSlot = 'lunch', limit = 6) {
  return quickAddItems({ savedMeals, macrosOf, slot, limit });
}

describe('franja por la hora', () => {
  it('reparte el día como lo vive una persona', () => {
    expect(slotFromHour('09:00')).toBe('breakfast');
    expect(slotFromHour('11:00')).toBe('breakfast');
    expect(slotFromHour('14:30')).toBe('lunch');
    expect(slotFromHour('18:00')).toBe('snack');
    expect(slotFromHour('21:30')).toBe('dinner');
  });
});

describe('qué se ofrece de un toque', () => {
  it('sin nada guardado, ofrece los básicos componibles', () => {
    const items = run([]);
    expect(items.length).toBeGreaterThan(0);
    expect(items.every((i) => i.kind === 'composition')).toBe(true);
  });

  it('lo que el usuario come de verdad va por delante de los constructores', () => {
    const items = run([meal({ name: 'Arroz de siempre', useCount: 20 })]);
    expect(items[0].kind).toBe('saved');
    expect(items[0].name).toBe('Arroz de siempre');
  });

  it('una comida guardada se registra de un toque; una composición hay que concretarla', () => {
    const items = run([meal({ name: 'Arroz de siempre', useCount: 5 })]);
    expect(items.find((i) => i.kind === 'saved')!.instant).toBe(true);
    expect(items.find((i) => i.kind === 'composition')!.instant).toBe(false);
  });

  it('ordena por uso, pero sin que lo muy usado tape el resto para siempre', () => {
    const items = run([
      meal({ name: 'Poco usada', useCount: 1 }),
      meal({ name: 'Muy usada', useCount: 40 }),
    ]);
    expect(items[0].name).toBe('Muy usada');
    // La poco usada sigue estando a la vista.
    expect(items.map((i) => i.name)).toContain('Poco usada');
  });

  it('la hora empuja lo que encaja con la franja', () => {
    const desayuno = meal({ name: 'Tostadas con aguacate', useCount: 3, slotHint: 'breakfast' });
    const cena = meal({ name: 'Atún con tomate', useCount: 3, slotHint: 'dinner' });
    expect(run([desayuno, cena], 'breakfast')[0].name).toBe('Tostadas con aguacate');
    expect(run([desayuno, cena], 'dinner')[0].name).toBe('Atún con tomate');
  });

  it('cuando ya existe su café concreto, el constructor de café deja de estorbar arriba', () => {
    const items = run([meal({ name: 'Café con leche de soja, vaso', useCount: 30 })], 'breakfast');
    const posCafeGuardado = items.findIndex((i) => i.kind === 'saved');
    const posConstructor = items.findIndex((i) => i.kind === 'composition' && i.id === 'cafe');
    expect(posCafeGuardado).toBeLessThan(posConstructor === -1 ? 99 : posConstructor);
  });

  it('respeta el límite de huecos de la pantalla', () => {
    const muchas = Array.from({ length: 20 }, (_, i) => meal({ name: `Comida ${i}`, useCount: i }));
    expect(run(muchas, 'lunch', 6)).toHaveLength(6);
  });

  it('da un icono distinto según lo que sea, para poder distinguirlas de un vistazo', () => {
    const items = run([
      meal({ name: 'Café con leche', useCount: 9 }),
      meal({ name: 'Batido de proteína', useCount: 8 }),
      meal({ name: 'Yogur con cereales', useCount: 7 }),
      meal({ name: 'Arroz con pollo', useCount: 6 }),
    ]);
    const iconos = items.filter((i) => i.kind === 'saved').map((i) => i.icon);
    expect(new Set(iconos).size).toBeGreaterThan(2);
  });

  it('lleva los macros de cada comida para poder decidir sin abrirla', () => {
    const items = run([meal({ name: 'Arroz de siempre', useCount: 3 })]);
    const saved = items.find((i) => i.kind === 'saved')!;
    expect(saved.kcal).toBe(400);
    expect(saved.protein).toBe(30);
  });
});

describe('tipos', () => {
  it('EMPTY_NUTRIENTS sigue siendo la base neutra', () => {
    expect(EMPTY_NUTRIENTS.kcal).toBe(0);
  });
});
