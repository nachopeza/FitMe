import { describe, expect, it } from 'vitest';
import { SEED_FOODS } from '../data/foods';
import { computeTargets } from './nutrition';
import { recommendMeals, substitutionsFor, isRestricted } from './recommender';
import { EMPTY_NUTRIENTS, type Nutrients, type SuggestionContext } from './types';

const foods = new Map(SEED_FOODS.map((f) => [f.id, f]));
const targets = computeTargets({
  sex: 'male', weightKg: 66.5, heightCm: 175, age: 25, activityLevel: 'moderate',
  typicalSteps: 8000, trainingDaysPerWeek: 4, goal: 'leanGain',
});

function ctx(over: Partial<SuggestionContext> = {}): SuggestionContext {
  const consumed: Nutrients = { ...EMPTY_NUTRIENTS, kcal: 2000, protein: 125, carbs: 230, fat: 60, fiber: 23 };
  return {
    consumed,
    targets,
    remaining: { kcal: 400, protein: 15, carbs: 70, fat: 15, fiber: 7 },
    dayType: 'training',
    hunger: 'normal',
    digestion: 'good',
    now: '21:15',
    slot: 'dinner',
    trained: true,
    restrictions: [],
    dislikes: [],
    ...over,
  };
}

describe('¿qué como ahora?', () => {
  it('devuelve tres opciones con comida real y cantidades concretas', () => {
    const out = recommendMeals({ ctx: ctx(), foods });
    expect(out).toHaveLength(3);
    for (const s of out) {
      expect(s.items.length).toBeGreaterThan(0);
      for (const i of s.items) {
        expect(i.grams).toBeGreaterThan(0);
        expect(foods.has(i.foodId)).toBe(true);
      }
      expect(s.nutrients.kcal).toBeGreaterThan(100);
      expect(s.why.length).toBeGreaterThan(0);
    }
  });

  it('no propone dos veces lo mismo', () => {
    const out = recommendMeals({ ctx: ctx(), foods });
    expect(new Set(out.map((s) => s.title)).size).toBe(out.length);
  });

  it('se ajusta a lo que falta: con poco restante propone comidas pequeñas', () => {
    const grande = recommendMeals({ ctx: ctx({ remaining: { kcal: 900, protein: 55, carbs: 110, fat: 30, fiber: 10 } }), foods });
    const pequeno = recommendMeals({ ctx: ctx({ remaining: { kcal: 250, protein: 12, carbs: 30, fat: 8, fiber: 3 } }), foods });
    expect(grande[0].nutrients.kcal).toBeGreaterThan(pequeno[0].nutrients.kcal);
  });

  it('prioriza la proteína cuando es lo que más falta', () => {
    const out = recommendMeals({ ctx: ctx({ remaining: { kcal: 600, protein: 50, carbs: 40, fat: 20, fiber: 5 } }), foods });
    expect(out[0].nutrients.protein).toBeGreaterThan(30);
  });
});

describe('cena rápida después de entrenar', () => {
  it('solo propone comidas de preparación corta', () => {
    const out = recommendMeals({ ctx: ctx({ mode: 'quick' }), foods });
    expect(out.length).toBeGreaterThan(0);
    for (const s of out) expect(s.prepMinutes).toBeLessThanOrEqual(12);
  });
});

describe('modo no quiero cocinar', () => {
  it('solo propone comidas sin cocinar de 5 minutos o menos', () => {
    const out = recommendMeals({ ctx: ctx({ mode: 'noCook' }), foods });
    expect(out.length).toBeGreaterThan(0);
    for (const s of out) expect(s.prepMinutes).toBeLessThanOrEqual(5);
  });
});

describe('poco apetito', () => {
  it('propone comidas densas, no ensaladas enormes', () => {
    const out = recommendMeals({
      ctx: ctx({ hunger: 'veryLow', remaining: { kcal: 500, protein: 30, carbs: 50, fat: 18, fiber: 6 } }),
      foods,
    });
    const top = out[0];
    const totalGrams = top.items.reduce((a, i) => a + i.grams, 0);
    // Densidad energética: al menos 1,2 kcal por gramo de comida.
    expect(top.nutrients.kcal / totalGrams).toBeGreaterThan(1.2);
  });

  it('con apetito normal sí puede proponer más volumen', () => {
    const bajo = recommendMeals({ ctx: ctx({ hunger: 'veryLow' }), foods })[0];
    const normal = recommendMeals({ ctx: ctx({ hunger: 'high' }), foods })[0];
    const g = (s: typeof bajo) => s.items.reduce((a, i) => a + i.grams, 0);
    expect(g(bajo)).toBeLessThan(g(normal));
  });
});

describe('digestión', () => {
  it('evita alimentos muy fermentables si hay hinchazón', () => {
    const out = recommendMeals({ ctx: ctx({ digestion: 'bloated' }), foods });
    const fermentables = out.flatMap((s) => s.items).filter((i) => foods.get(i.foodId)?.fermentability === 'high');
    expect(fermentables).toHaveLength(0);
  });
});

describe('tengo esto en casa', () => {
  it('solo usa los alimentos disponibles', () => {
    const available = ['arroz-cocido', 'huevo', 'atun-natural', 'tomate', 'yogur-natural', 'pollo-pechuga-cocinada'];
    const out = recommendMeals({ ctx: ctx({ availableFoodIds: available, mode: 'normal' }), foods });
    expect(out.length).toBeGreaterThan(0);
    const staples = new Set(['aceite-oliva', 'cafe', 'te', 'miel', 'azucar', 'salsa-soja', 'ketchup', 'sal']);
    for (const s of out) {
      for (const i of s.items) {
        expect(available.includes(i.foodId) || staples.has(i.foodId)).toBe(true);
      }
    }
  });
});

describe('restricciones y preferencias', () => {
  it('respeta una restricción declarada', () => {
    const out = recommendMeals({ ctx: ctx({ restrictions: ['sin pescado'] }), foods });
    const fish = out.flatMap((s) => s.items).filter((i) => foods.get(i.foodId)?.proteinSource === 'fish');
    expect(fish).toHaveLength(0);
  });
  it('nunca propone algo que el usuario ha marcado que no le gusta', () => {
    const out = recommendMeals({ ctx: ctx({ dislikes: ['huevo', 'atun-natural'] }), foods });
    const bad = out.flatMap((s) => s.items).filter((i) => i.foodId === 'huevo' || i.foodId === 'atun-natural');
    expect(bad).toHaveLength(0);
  });
  it('clasifica bien las restricciones frecuentes', () => {
    expect(isRestricted(foods.get('jamon-serrano'), ['sin cerdo'])).toBe(true);
    expect(isRestricted(foods.get('pan-blanco'), ['sin gluten'])).toBe(true);
    expect(isRestricted(foods.get('queso-curado'), ['sin lactosa'])).toBe(true);
    expect(isRestricted(foods.get('bebida-soja'), ['sin lactosa'])).toBe(false);
    expect(isRestricted(foods.get('pollo-pechuga-cocinada'), ['vegetariano'])).toBe(true);
  });
});

describe('comidas guardadas', () => {
  it('prioriza lo que el usuario ya come habitualmente', () => {
    const arrozSiempre = {
      id: 'sm1',
      name: 'Arroz de siempre',
      prepMinutes: 15,
      useCount: 40,
      createdAt: 0,
      items: [
        { foodId: 'arroz-cocido', foodName: 'Arroz', quantity: 200, unit: 'g' as const, grams: 200, confidence: 'exact' as const, nutrients: { ...EMPTY_NUTRIENTS, kcal: 260, protein: 5.4, carbs: 56, fat: 0.6, fiber: 0.8 } },
        { foodId: 'huevo', foodName: 'Huevo', quantity: 2, unit: 'portion' as const, grams: 110, confidence: 'exact' as const, nutrients: { ...EMPTY_NUTRIENTS, kcal: 157, protein: 13.9, carbs: 0.8, fat: 10.5, fiber: 0 } },
      ],
    };
    const out = recommendMeals({ ctx: ctx(), foods, savedMeals: [arrozSiempre] });
    expect(out[0].savedMealId).toBe('sm1');
  });
});

describe('sustituciones', () => {
  it('propone alternativas con proteína parecida', () => {
    const pollo = foods.get('pollo-pechuga-cocinada')!;
    const subs = substitutionsFor(pollo, 100, SEED_FOODS);
    expect(subs.length).toBeGreaterThan(2);
    for (const s of subs) {
      expect(s.food.id).not.toBe(pollo.id);
      // La energía no se desvía más de un 45%.
      expect(Math.abs(s.kcalDelta)).toBeLessThan(0.45);
      expect(s.grams).toBeGreaterThan(0);
    }
  });
  it('no sustituye un alimento proteico por una verdura', () => {
    const subs = substitutionsFor(foods.get('pollo-pechuga-cocinada')!, 100, SEED_FOODS, 10);
    expect(subs.every((s) => s.food.per100g.protein >= 8)).toBe(true);
  });
});

describe('límites de las plantillas', () => {
  it('nunca propone más cantidad de la que la plantilla permite', () => {
    // Con un hueco enorme, el motor tiende a estirar cada ingrediente al máximo:
    // es el caso donde el redondeo a unidades discretas se saltaba el tope.
    const out = recommendMeals({
      ctx: ctx({ remaining: { kcal: 2000, protein: 140, carbs: 250, fat: 70, fiber: 30 } }),
      foods,
      limit: 8,
    });
    expect(out.length).toBeGreaterThan(0);
    for (const s of out) {
      for (const i of s.items) {
        const food = foods.get(i.foodId)!;
        // Ninguna ración razonable de un solo alimento pasa de 400 g,
        // ni aporta más de 70 g de proteína.
        expect(i.grams).toBeLessThanOrEqual(400);
        const protein = (food.per100g.protein * i.grams) / 100;
        expect(protein).toBeLessThanOrEqual(70);
      }
    }
  });

  it('respeta el tope concreto de la plantilla de fajitas de pollo', () => {
    const out = recommendMeals({
      ctx: ctx({ remaining: { kcal: 1800, protein: 120, carbs: 200, fat: 60, fiber: 25 } }),
      foods,
      limit: 10,
    });
    const fajitas = out.find((s) => s.id === 'bp-fajita-pollo');
    if (fajitas) {
      const pollo = fajitas.items.find((i) => i.foodId === 'pollo-pechuga-cocinada');
      expect(pollo?.grams ?? 0).toBeLessThanOrEqual(180);
    }
  });
});

describe('calidad de las propuestas', () => {
  it('nunca propone una comida de un solo alimento', () => {
    for (const mode of ['normal', 'quick', 'noCook'] as const) {
      const out = recommendMeals({ ctx: ctx({ mode }), foods, limit: 6 });
      for (const s of out) {
        const staples = new Set(['aceite-oliva', 'cafe', 'te', 'miel', 'azucar', 'salsa-soja', 'ketchup']);
        const real = s.items.filter((i) => !staples.has(i.foodId));
        expect(real.length, `"${s.title}" solo lleva ${real.length} alimento`).toBeGreaterThanOrEqual(2);
      }
    }
  });

  it('en modo despensa sigue componiendo comidas completas', () => {
    const available = ['arroz-cocido', 'huevo', 'atun-natural', 'tomate', 'yogur-natural', 'pollo-pechuga-cocinada'];
    const out = recommendMeals({ ctx: ctx({ availableFoodIds: available }), foods, limit: 3 });
    expect(out.length).toBeGreaterThan(0);
    for (const s of out) {
      const staples = new Set(['aceite-oliva', 'cafe', 'te', 'miel', 'azucar', 'salsa-soja', 'ketchup']);
      expect(s.items.filter((i) => !staples.has(i.foodId)).length).toBeGreaterThanOrEqual(2);
    }
  });

  it('no repite la misma combinación de alimentos con dos nombres', () => {
    const out = recommendMeals({ ctx: ctx(), foods, limit: 3 });
    const keys = out.map((s) => [...s.items.map((i) => i.foodId)].sort().join('|'));
    expect(new Set(keys).size).toBe(keys.length);
  });
});

describe('sensatez de las sustituciones', () => {
  it('no propone condimentos como fuente de proteína', () => {
    const subs = substitutionsFor(foods.get('pollo-pechuga-cocinada')!, 100, SEED_FOODS, 20);
    for (const s of subs) {
      expect(['other', 'drink']).not.toContain(s.food.category);
      expect(s.food.id).not.toBe('salsa-soja');
    }
  });

  it('las cantidades propuestas son comibles', () => {
    for (const id of ['pollo-pechuga-cocinada', 'atun-natural', 'huevo', 'yogur-proteico']) {
      for (const s of substitutionsFor(foods.get(id)!, 120, SEED_FOODS, 20)) {
        expect(s.grams, `${s.food.name} para sustituir ${id}`).toBeLessThanOrEqual(360);
        expect(s.food.per100g.protein).toBeGreaterThanOrEqual(10);
      }
    }
  });

  it('sigue encontrando sustitutos razonables para el pollo', () => {
    const subs = substitutionsFor(foods.get('pollo-pechuga-cocinada')!, 150, SEED_FOODS, 8);
    expect(subs.length).toBeGreaterThan(2);
    const ids = subs.map((s) => s.food.id);
    // Atún, huevos, ternera o pavo son sustitutos evidentes: alguno debe salir.
    expect(ids.some((i) => /atun|huevo|ternera|pavo|merluza|langostinos|lomo/.test(i))).toBe(true);
  });
});
