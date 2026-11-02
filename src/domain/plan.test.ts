import { describe, expect, it } from 'vitest';
import { PLAN_DINNERS, PLAN_MEALS, PLAN_TARGETS } from '../data/plan';
import { SEED_FOODS } from '../data/foods';
import {
  planDayTotal, planForDay, planGap, planLevers, planTargets, resolveDinner, resolveMeal,
} from './plan';

const foods = new Map(SEED_FOODS.map((f) => [f.id, f]));

/**
 * Lo que de verdad se comprueba aquí es si he transcrito bien la hoja. Su plan
 * da las kcal aproximadas de cada comida; si mis gramos y mis alimentos dan
 * otra cosa, es que me he equivocado de alimento o de cantidad.
 */
describe('las comidas del plan', () => {
  it('no apunta a ningún alimento que no esté en la base', () => {
    for (const meal of PLAN_MEALS) {
      expect(resolveMeal(meal, foods).missing).toEqual([]);
    }
    for (const dinner of PLAN_DINNERS) {
      expect(resolveDinner(dinner, foods).missing).toEqual([]);
    }
  });

  it('ninguna comida se pasa de lo que dice la hoja', () => {
    for (const meal of PLAN_MEALS) {
      const r = resolveMeal(meal, foods);
      // Por arriba sí se comprueba: pasarse sería haber puesto de más.
      // Por abajo no, y es a propósito. Las cantidades escritas son el extremo
      // BAJO del rango de cada comida —ahí está el hallazgo de planGap— y el
      // desayuno sin el pan y el pavo opcionales da 67 kcal frente a las 100
      // que redondea la hoja. Los alimentos mandan sobre el redondeo.
      expect(r.nutrients.kcal).toBeLessThanOrEqual(meal.kcalTo * 1.12);
    }
  });

  it('hay una cena para cada día de la semana', () => {
    const dias = PLAN_DINNERS.map((d) => d.weekday).sort();
    expect(dias).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it('las cantidades escritas se quedan por debajo del objetivo, y hay que decirlo', () => {
    // Esto no es un fallo del plan ni de la transcripción: es el hallazgo. Las
    // cantidades escritas son el extremo bajo de cada rango, así que el día
    // suma menos que el objetivo. Si algún día esto dejara de cumplirse,
    // querría decir que alguien cambió las cantidades y que el aviso de la app
    // sobra: por eso se prueba, para que salte.
    for (let dia = 0; dia < 7; dia++) {
      const g = planGap(dia, foods);
      expect(g.planned).toBeLessThan(PLAN_TARGETS.kcal.min);
      expect(g.short).toBeGreaterThan(0);
      // Pero tampoco un disparate: dentro de 700 kcal del objetivo.
      expect(g.short).toBeLessThan(700);
    }
  });

  it('los márgenes de la hoja bastan para cerrar el hueco, cualquier día', () => {
    // Si no bastaran, la app estaría enseñando un hueco sin salida y habría que
    // decirle que hable con quien le hizo el plan.
    for (let dia = 0; dia < 7; dia++) {
      const hueco = planGap(dia, foods).short;
      const margen = planLevers(dia, foods).reduce((a, l) => a + l.kcal, 0);
      expect(margen).toBeGreaterThanOrEqual(hueco);
    }
  });

  it('en el día más flojo, el cambio de cena es el primer margen', () => {
    // El jueves (pescado con patata) es la cena más baja de la rotación.
    expect(planLevers(4, foods)[0].label).toMatch(/^Cambiar la cena/);
  });

  it('un día entero llega a la proteína del plan', () => {
    for (let dia = 0; dia < 7; dia++) {
      expect(planDayTotal(dia, foods).protein).toBeGreaterThanOrEqual(PLAN_TARGETS.protein.min * 0.9);
    }
  });

  it('la cena de hoy es la del día que toca', () => {
    expect(planForDay(1, foods)[3].name).toBe('Pasta boloñesa');
    expect(planForDay(0, foods)[3].name).toBe('Revuelto completo');
  });
});

describe('los objetivos del plan', () => {
  it('respeta los números escritos en la hoja', () => {
    const t = planTargets();
    expect(t.kcal.min).toBe(2300);
    expect(t.kcal.max).toBe(2500);
    expect(t.protein.min).toBe(125);
    expect(t.protein.max).toBe(140);
  });

  it('viene marcado como manual para que el ajuste automático no lo pise', () => {
    expect(planTargets().origin).toBe('manual');
  });

  it('el reparto de macros cuadra con la energía', () => {
    const t = planTargets();
    const kcalMin = t.protein.min * 4 + t.carbs.min * 4 + t.fat.min * 9;
    const kcalMax = t.protein.max * 4 + t.carbs.max * 4 + t.fat.max * 9;
    expect(kcalMin).toBeGreaterThan(t.kcal.min * 0.9);
    expect(kcalMin).toBeLessThan(t.kcal.min * 1.1);
    expect(kcalMax).toBeGreaterThan(t.kcal.max * 0.9);
    expect(kcalMax).toBeLessThan(t.kcal.max * 1.1);
  });
});

// ── Sus cantidades mandan sobre las de la hoja ──
describe('cantidades propias', () => {
  const taper = PLAN_MEALS.find((m) => m.id === 'plan-taper')!;

  it('sin ajustes, manda la hoja', () => {
    const r = resolveMeal(taper, foods);
    expect(r.parts[0].grams).toBe(120);
    expect(r.edited).toBe(false);
  });

  it('con ajuste, mandan las suyas', () => {
    const r = resolveMeal(taper, foods, {
      'plan-taper': [{ foodId: 'arroz-crudo', grams: 100 }, { foodId: 'huevo', grams: 165 }],
    });
    expect(r.parts.map((p) => p.grams)).toEqual([100, 165]);
    expect(r.edited).toBe(true);
    // Y los macros se recalculan con lo suyo, no con lo de la hoja.
    expect(r.nutrients.kcal).toBeLessThan(resolveMeal(taper, foods).nutrients.kcal);
  });

  it('un ajuste de otra comida no toca esta', () => {
    const r = resolveMeal(taper, foods, { 'plan-merienda': [{ foodId: 'platano', grams: 200 }] });
    expect(r.parts[0].grams).toBe(120);
    expect(r.edited).toBe(false);
  });

  it('una lista vacía no cuenta como ajuste: se vuelve a la hoja', () => {
    const r = resolveMeal(taper, foods, { 'plan-taper': [] });
    expect(r.parts[0].grams).toBe(120);
    expect(r.edited).toBe(false);
  });

  it('las cenas también se pueden ajustar', () => {
    const lunes = PLAN_DINNERS.find((d) => d.weekday === 1)!;
    const r = resolveDinner(lunes, foods, { 'plan-cena-1': [{ foodId: 'pasta-cruda', grams: 140 }] });
    expect(r.parts).toHaveLength(1);
    expect(r.parts[0].grams).toBe(140);
  });

  it('el ajuste SUSTITUYE la lista, no la completa', () => {
    // Es a propósito, y es lo que permite quitar un alimento: si solo añadiera
    // o cambiara gramos, no habría forma de decir «hoy sin huevo».
    const soloArroz = resolveMeal(taper, foods, {
      'plan-taper': [{ foodId: 'arroz-crudo', grams: 200 }],
    });
    expect(soloArroz.parts).toHaveLength(1);
    expect(soloArroz.nutrients.kcal).toBeLessThan(resolveMeal(taper, foods).nutrients.kcal);
  });

  it('el día entero cuenta con sus cantidades', () => {
    const mas = planForDay(1, foods, {
      'plan-taper': taper.parts.map((p) => ({
        foodId: p.foodId,
        grams: p.foodId === 'arroz-crudo' ? 200 : p.grams,
      })),
    });
    const sin = planForDay(1, foods);
    expect(mas[1].nutrients.kcal).toBeGreaterThan(sin[1].nutrients.kcal);
  });
});
