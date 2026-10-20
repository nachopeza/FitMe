import { describe, expect, it } from 'vitest';
import {
  COMPOSITIONS, defaultChoice, describeChoice, getComposition, isSlotHidden, resolveComposition,
  type CompositionChoice,
} from './compositions';
import { SEED_FOODS } from './foods';
import { scaleNutrients, sumNutrients } from '../domain/nutrition';

const byId = new Map(SEED_FOODS.map((f) => [f.id, f]));

/** Macros reales de una selección, resueltos contra la base de alimentos. */
function macros(compId: string, choice: CompositionChoice) {
  const comp = getComposition(compId)!;
  const parts = resolveComposition(comp, choice);
  return sumNutrients(parts.map((p) => scaleNutrients(byId.get(p.foodId)!.per100g, p.grams)));
}

describe('integridad de las composiciones', () => {
  it('todos los alimentos referenciados existen en la base', () => {
    const faltan: string[] = [];
    for (const comp of COMPOSITIONS) {
      for (const slot of comp.slots) {
        for (const option of slot.options) {
          for (const part of option.parts) {
            if (!byId.has(part.foodId)) faltan.push(`${comp.id}/${slot.id}/${option.id}: ${part.foodId}`);
          }
        }
      }
    }
    expect(faltan).toEqual([]);
  });

  it('cada hueco obligatorio arranca con algo marcado', () => {
    for (const comp of COMPOSITIONS) {
      const choice = defaultChoice(comp);
      for (const slot of comp.slots) {
        if (slot.multi || slot.optional) continue;
        expect(choice[slot.id]?.length, `${comp.id}/${slot.id}`).toBe(1);
      }
    }
  });

  it('ninguna composición sale vacía con sus valores por defecto', () => {
    for (const comp of COMPOSITIONS) {
      const parts = resolveComposition(comp, defaultChoice(comp));
      expect(parts.length, comp.id).toBeGreaterThan(0);
    }
  });
});

describe('el café, que es el que había que arreglar', () => {
  const comp = getComposition('cafe')!;

  it('un café solo son unas pocas calorías, y nada más', () => {
    const n = macros('cafe', { base: ['solo'], leche: ['sin-leche'], cantidad: ['vaso'], azucar: ['nada'] });
    expect(n.kcal).toBeLessThan(5);
  });

  it('un café con leche de soja en vaso son unas 50 kcal con 5 g de proteína', () => {
    const n = macros('cafe', { base: ['solo'], leche: ['soja'], cantidad: ['vaso'], azucar: ['nada'] });
    // 150 ml de bebida de soja: 49 kcal, 5 g de proteína.
    expect(n.kcal).toBeGreaterThan(40);
    expect(n.kcal).toBeLessThan(65);
    expect(n.protein).toBeGreaterThan(4);
  });

  it('la cantidad de leche cambia el resultado', () => {
    const nube = macros('cafe', { base: ['solo'], leche: ['entera'], cantidad: ['nube'], azucar: ['nada'] });
    const vaso = macros('cafe', { base: ['solo'], leche: ['entera'], cantidad: ['vaso'], azucar: ['nada'] });
    const grande = macros('cafe', { base: ['solo'], leche: ['entera'], cantidad: ['grande'], azucar: ['nada'] });
    expect(nube.kcal).toBeLessThan(vaso.kcal);
    expect(vaso.kcal).toBeLessThan(grande.kcal);
    // Una taza grande con leche entera pasa de 130 kcal: no es "un café".
    expect(grande.kcal).toBeGreaterThan(130);
  });

  it('el tipo de leche cambia el resultado', () => {
    const base = { base: ['solo'], cantidad: ['vaso'], azucar: ['nada'] };
    const desnatada = macros('cafe', { ...base, leche: ['desnatada'] });
    const entera = macros('cafe', { ...base, leche: ['entera'] });
    const avena = macros('cafe', { ...base, leche: ['avena'] });
    expect(desnatada.kcal).toBeLessThan(entera.kcal);
    expect(avena.carbs).toBeGreaterThan(entera.carbs);
  });

  it('el azúcar suma lo que tiene que sumar', () => {
    const sin = macros('cafe', { base: ['solo'], leche: ['sin-leche'], cantidad: ['vaso'], azucar: ['nada'] });
    const con2 = macros('cafe', { base: ['solo'], leche: ['sin-leche'], cantidad: ['vaso'], azucar: ['azucar2'] });
    expect(con2.kcal - sin.kcal).toBeCloseTo(40, 0);
  });

  it('el hueco de cantidad desaparece si no lleva leche', () => {
    const cantidad = comp.slots.find((s) => s.id === 'cantidad')!;
    expect(isSlotHidden(cantidad, { leche: ['sin-leche'] })).toBe(true);
    expect(isSlotHidden(cantidad, { leche: ['soja'] })).toBe(false);
  });

  it('sin leche no cuela leche por la puerta de atrás', () => {
    const parts = resolveComposition(comp, { base: ['solo'], leche: ['sin-leche'], cantidad: ['grande'], azucar: ['nada'] });
    expect(parts.some((p) => /leche|soja|avena/.test(p.foodId))).toBe(false);
  });

  it('se describe como lo diría una persona', () => {
    expect(describeChoice(comp, { base: ['solo'], leche: ['sin-leche'], cantidad: ['vaso'], azucar: ['nada'] }))
      .toBe('Café solo');
    expect(describeChoice(comp, { base: ['solo'], leche: ['soja'], cantidad: ['vaso'], azucar: ['nada'] }))
      .toBe('Café con leche de soja, vaso');
  });
});

describe('composiciones con varios añadidos', () => {
  it('suma todos los añadidos marcados de un yogur', () => {
    const solo = macros('yogur', { base: ['proteico'], 'añadidos': [] });
    const cargado = macros('yogur', { base: ['proteico'], 'añadidos': ['cereales', 'platano', 'crema-cacahuete'] });
    expect(cargado.kcal).toBeGreaterThan(solo.kcal + 250);
    expect(cargado.protein).toBeGreaterThan(solo.protein);
  });

  it('una tostada con tomate y aceite lleva las dos cosas', () => {
    const parts = resolveComposition(getComposition('tostada')!, { pan: ['blanca-2'], encima: ['tomate-aceite'] });
    const ids = parts.map((p) => p.foodId);
    expect(ids).toContain('tomate');
    expect(ids).toContain('aceite-oliva');
    expect(ids).toContain('pan-blanco');
  });

  it('un batido completo es denso: lo que necesita quien come poco', () => {
    const n = macros('batido', {
      liquido: ['entera'], proteina: ['dos'], extras: ['platano', 'avena', 'crema-cacahuete'],
    });
    expect(n.kcal).toBeGreaterThan(750);
    expect(n.protein).toBeGreaterThan(55);
  });

  it('si un alimento entra por dos huecos, los gramos se suman una sola vez', () => {
    const parts = resolveComposition(getComposition('yogur')!, {
      base: ['griego'], 'añadidos': ['crema-cacahuete'],
    });
    const ids = parts.map((p) => p.foodId);
    expect(new Set(ids).size).toBe(ids.length);
  });
});
