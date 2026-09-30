import { describe, expect, it } from 'vitest';
import { SEED_FOODS } from '../data/foods';
import {
  classifyDay, computeTargets, convertState, energyMismatch, energyMismatchKcal,
  estimateMaintenance, macroStatus, resolveGrams, scaleNutrients, targetsForDay,
} from './nutrition';

const byId = new Map(SEED_FOODS.map((f) => [f.id, f]));

/** Perfil real del usuario: 66,5 kg, entrena fuerza 4 días, objetivo ganar músculo. */
const ME = {
  sex: 'male' as const,
  weightKg: 66.5,
  heightCm: 175,
  age: 25,
  activityLevel: 'moderate' as const,
  typicalSteps: 8000,
  trainingDaysPerWeek: 4,
  trainingMinutes: 55,
  goal: 'leanGain' as const,
};

describe('coherencia de la base de alimentos', () => {
  it('las kcal declaradas cuadran con los macros de cada alimento', () => {
    // Se exige coherencia a la vez en relativo y en absoluto: así se detectan
    // erratas de captura sin exigir que la energía publicada coincida con los
    // factores generales de Atwater, de los que legítimamente se separa en
    // carnes, aceites y frutos secos.
    const bad = SEED_FOODS.filter(
      (f) => energyMismatch(f.per100g) > 0.12 && energyMismatchKcal(f.per100g) > 25,
    ).map((f) => f.id);
    expect(bad).toEqual([]);
  });

  it('ningún alimento tiene más fibra que carbohidratos más fibra', () => {
    for (const f of SEED_FOODS) {
      expect(f.per100g.fiber).toBeLessThanOrEqual(f.per100g.carbs + f.per100g.fiber + 0.01);
      expect(f.per100g.satFat ?? 0).toBeLessThanOrEqual(f.per100g.fat + 0.01);
      expect(f.per100g.sugars ?? 0).toBeLessThanOrEqual(f.per100g.carbs + 0.01);
    }
  });
  it('todo alimento tiene al menos una ración y una por defecto', () => {
    for (const f of SEED_FOODS) {
      expect(f.portions.length).toBeGreaterThan(0);
      expect(f.portions.some((p) => p.isDefault)).toBe(true);
    }
  });
  it('no hay ids duplicados', () => {
    expect(new Set(SEED_FOODS.map((f) => f.id)).size).toBe(SEED_FOODS.length);
  });
  it('las parejas crudo/cocinado se apuntan entre sí y existen', () => {
    for (const f of SEED_FOODS) {
      if (!f.counterpartId) continue;
      expect(byId.has(f.counterpartId)).toBe(true);
    }
  });
});

describe('crudo frente a cocinado', () => {
  it('100 g de arroz crudo no son 100 g de arroz cocido', () => {
    const crudo = byId.get('arroz-crudo')!;
    const cocido = byId.get('arroz-cocido')!;
    expect(crudo.per100g.kcal).toBeGreaterThan(cocido.per100g.kcal * 2.5);
  });
  it('convierte gramos crudos en cocinados con el rendimiento real', () => {
    expect(convertState(byId.get('arroz-crudo')!, 80, 'cooked')).toBe(200);
    expect(convertState(byId.get('pollo-pechuga-cruda')!, 100, 'cooked')).toBeCloseTo(72);
  });
  it('no inventa la conversión si no hay dato de rendimiento', () => {
    expect(convertState(byId.get('huevo')!, 100, 'cooked')).toBeNull();
  });
});

describe('raciones', () => {
  it('resuelve unidades a gramos', () => {
    expect(resolveGrams(byId.get('huevo')!, 2, 'portion')).toBe(110);
    expect(resolveGrams(byId.get('pan-blanco')!, 2, 'portion', 'rebanada')).toBe(60);
    expect(resolveGrams(byId.get('pollo-pechuga-cocinada')!, 150, 'g')).toBe(150);
  });
  it('escala nutrientes de forma lineal', () => {
    const n = scaleNutrients(byId.get('pollo-pechuga-cocinada')!.per100g, 150);
    expect(n.kcal).toBeCloseTo(247.5);
    expect(n.protein).toBeCloseTo(46.5);
  });
});

describe('objetivos iniciales', () => {
  const t = computeTargets(ME);

  it('sitúa las calorías en un superávit moderado, no en un volumen agresivo', () => {
    const maint = estimateMaintenance(ME).maintenance;
    expect(t.kcal.target).toBeGreaterThan(maint);
    expect(t.kcal.target - maint).toBeLessThan(maint * 0.15);
    expect(t.kcal.target).toBeGreaterThan(2300);
    expect(t.kcal.target).toBeLessThan(3100);
  });
  it('pone la proteína en 2 g por kg', () => {
    expect(t.protein.target).toBe(133);
  });
  it('da a cada macro un rango, no un número rígido', () => {
    for (const k of ['kcal', 'protein', 'carbs', 'fat', 'fiber'] as const) {
      expect(t[k].min).toBeLessThan(t[k].target);
      expect(t[k].max).toBeGreaterThan(t[k].target);
    }
    // 128 g de proteína con objetivo 133 debe seguir contando como "dentro".
    expect(macroStatus(128, t.protein)).toBe('inRange');
  });
  it('los macros suman aproximadamente las calorías objetivo', () => {
    const fromMacros = t.protein.target * 4 + t.carbs.target * 4 + t.fat.target * 9;
    expect(Math.abs(fromMacros - t.kcal.target) / t.kcal.target).toBeLessThan(0.08);
      (0.08);
  });
  it('respeta un mínimo de grasa y de carbohidrato por kg', () => {
    expect(t.fat.target).toBeGreaterThanOrEqual(Math.round(ME.weightKg * 0.8));
    expect(t.carbs.target).toBeGreaterThanOrEqual(Math.round(ME.weightKg * 3));
  });
  it('baja la fibra objetivo si hay mala tolerancia digestiva', () => {
    const low = computeTargets({ ...ME, digestiveTolerance: 'low' });
    expect(low.fiber.target).toBeLessThan(t.fiber.target);
  });
  it('explica de dónde salen los números', () => {
    expect(t.rationale.length).toBeGreaterThan(4);
    expect(t.rationale.join(' ')).toMatch(/basal/i);
  });
});

describe('macros dinámicos por tipo de día', () => {
  const base = computeTargets(ME);

  it('clasifica el día por entrenamiento y pasos', () => {
    expect(classifyDay({ trained: true, steps: 3000, typicalSteps: 8000 })).toBe('training');
    expect(classifyDay({ trained: false, steps: 14000, typicalSteps: 8000 })).toBe('highActivity');
    expect(classifyDay({ trained: false, steps: 3000, typicalSteps: 8000 })).toBe('lowActivity');
    expect(classifyDay({ trained: false, steps: 8000, typicalSteps: 8000 })).toBe('rest');
  });

  it('sube energía en día de entreno y la baja en descanso', () => {
    expect(targetsForDay(base, 'training').kcal.target).toBeGreaterThan(base.kcal.target);
    expect(targetsForDay(base, 'rest').kcal.target).toBeLessThan(base.kcal.target);
  });

  it('NO toca la proteína: se mantiene estable siempre', () => {
    for (const d of ['training', 'rest', 'highActivity', 'lowActivity'] as const) {
      expect(targetsForDay(base, d).protein).toEqual(base.protein);
    }
  });

  it('el ajuste recae sobre los carbohidratos', () => {
    const rest = targetsForDay(base, 'rest');
    expect(rest.carbs.target).toBeLessThan(base.carbs.target);
    // Y nunca recorta de forma brutal: como mucho un 10% de la energía.
    expect(rest.kcal.target).toBeGreaterThan(base.kcal.target * 0.88);
  });

  it('un día de descanso no se convierte en un día de dieta', () => {
    const rest = targetsForDay(base, 'rest');
    const maint = estimateMaintenance(ME).maintenance;
    expect(rest.kcal.target).toBeGreaterThan(maint * 0.95);
  });
});

describe('estado respecto al rango', () => {
  const r = { target: 135, min: 120, max: 155 };
  it('no castiga por estar dentro del margen', () => {
    expect(macroStatus(128, r)).toBe('inRange');
    expect(macroStatus(135, r)).toBe('inRange');
  });
  it('avisa cerca del límite y fuera de rango', () => {
    expect(macroStatus(153, r)).toBe('nearLimit');
    expect(macroStatus(170, r)).toBe('over');
    expect(macroStatus(90, r)).toBe('under');
  });
});

describe('no contar la actividad dos veces', () => {
  /**
   * El entrenamiento y los pasos se suman de forma explícita, así que el factor
   * de actividad debe cubrir SOLO la vida cotidiana. Si se usaran los
   * multiplicadores clásicos de Mifflin (que ya incluyen ejercicio), el gasto
   * saldría inflado y la "ganancia controlada" dejaría de serlo.
   */
  it('mantiene el mantenimiento en un rango defendible por kg de peso', () => {
    const est = estimateMaintenance(ME);
    const perKg = est.maintenance / ME.weightKg;
    expect(perKg).toBeGreaterThan(32);
    expect(perKg).toBeLessThan(40);
  });

  it('el objetivo de ganancia se queda en un superávit razonable por kg', () => {
    const t = computeTargets(ME);
    const perKg = t.kcal.target / ME.weightKg;
    expect(perKg).toBeGreaterThan(35);
    expect(perKg).toBeLessThan(43);
  });

  it('el entrenamiento y los pasos pesan lo que deben, no más', () => {
    const est = estimateMaintenance(ME);
    // 4 sesiones de 55 minutos a 66,5 kg reparten ~180 kcal/día.
    expect(est.fromTraining).toBeGreaterThan(120);
    expect(est.fromTraining).toBeLessThan(250);
    // 8.000 pasos sobre una base de 5.000 son unas 90 kcal.
    expect(est.fromSteps).toBeGreaterThan(50);
    expect(est.fromSteps).toBeLessThan(150);
  });

  it('subir el nivel de actividad sube el gasto, pero de forma contenida', () => {
    const sedentario = estimateMaintenance({ ...ME, activityLevel: 'sedentary' }).maintenance;
    const muyActivo = estimateMaintenance({ ...ME, activityLevel: 'veryActive' }).maintenance;
    expect(muyActivo).toBeGreaterThan(sedentario);
    expect(muyActivo - sedentario).toBeLessThan(sedentario * 0.35);
  });
});
