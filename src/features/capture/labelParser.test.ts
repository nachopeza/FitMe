import { describe, expect, it } from 'vitest';
import { parseNutritionLabel, validateLabel } from './labelParser';

describe('lectura de etiquetas españolas', () => {
  it('lee una tabla europea típica', () => {
    const r = parseNutritionLabel(`
      INFORMACIÓN NUTRICIONAL
      Valores medios por 100 g
      Valor energético 1.502 kJ / 359 kcal
      Grasas 1,5 g
      de las cuales saturadas 0,3 g
      Hidratos de carbono 71 g
      de los cuales azúcares 3,0 g
      Fibra alimentaria 3,2 g
      Proteínas 12,5 g
      Sal 0,02 g
    `);
    expect(r.per100g.kcal).toBe(359);
    expect(r.per100g.fat).toBe(1.5);
    expect(r.per100g.satFat).toBe(0.3);
    expect(r.per100g.carbs).toBe(71);
    expect(r.per100g.sugars).toBe(3);
    expect(r.per100g.fiber).toBe(3.2);
    expect(r.per100g.protein).toBe(12.5);
    expect(r.per100g.sodium).toBe(8);
    expect(r.missing).toEqual([]);
  });

  it('toma la columna de 100 g y no la de la ración', () => {
    const r = parseNutritionLabel(`
      por 100 g / por ración (30 g)
      Energía 400 kcal / 120 kcal
      Grasas 10 g / 3 g
      Hidratos de carbono 60 g / 18 g
      Fibra 5 g / 1,5 g
      Proteínas 20 g / 6 g
    `);
    expect(r.per100g.kcal).toBe(400);
    expect(r.per100g.protein).toBe(20);
    expect(r.per100g.carbs).toBe(60);
    expect(r.servingGrams).toBe(30);
  });

  it('convierte kilojulios cuando no hay kcal', () => {
    const r = parseNutritionLabel('Valor energético 2000 kJ\nProteínas 10 g\nGrasas 5 g\nHidratos de carbono 50 g\nFibra 2 g');
    expect(r.per100g.kcal).toBe(478);
  });

  it('entiende la coma decimal y el separador de millares', () => {
    const r = parseNutritionLabel('Energía 1.234 kJ / 295 kcal\nProteínas 8,75 g\nGrasas 2 g\nHidratos de carbono 55 g\nFibra 1 g');
    expect(r.per100g.kcal).toBe(295);
    expect(r.per100g.protein).toBe(8.75);
  });

  it('interpreta "<0,5 g" y "trazas" como cero', () => {
    const r = parseNutritionLabel('Energía 100 kcal\nGrasas <0,5 g\nHidratos de carbono 20 g\nFibra 1 g\nProteínas 5 g');
    expect(r.per100g.fat).toBe(0.5);
  });

  it('convierte la sal declarada en sodio', () => {
    const r = parseNutritionLabel('Energía 100 kcal\nGrasas 1 g\nHidratos de carbono 10 g\nFibra 1 g\nProteínas 5 g\nSal 1,25 g');
    expect(r.per100g.sodium).toBe(500);
  });

  it('dice qué falta en lugar de inventarlo', () => {
    const r = parseNutritionLabel('Energía 250 kcal\nProteínas 20 g');
    expect(r.missing).toContain('grasas');
    expect(r.missing).toContain('hidratos de carbono');
    expect(r.missing).toContain('fibra');
    expect(r.per100g.protein).toBe(20);
  });
});

describe('validación de lo leído', () => {
  it('acepta una lectura coherente', () => {
    expect(validateLabel({ kcal: 359, protein: 12.5, carbs: 71, fat: 1.5, fiber: 3.2 })).toEqual([]);
  });
  it('detecta que se ha colado la columna de la ración', () => {
    // Energía de 100 g con macros de una ración de 30 g.
    const problems = validateLabel({ kcal: 400, protein: 6, carbs: 18, fat: 3, fiber: 1.5 });
    expect(problems.join(' ')).toMatch(/no cuadra/i);
  });
  it('detecta imposibilidades', () => {
    expect(validateLabel({ kcal: 300, protein: 50, carbs: 60, fat: 20, fiber: 5 }).join(' ')).toMatch(/más de 100 g/);
    expect(validateLabel({ kcal: 300, fat: 5, satFat: 9 }).join(' ')).toMatch(/saturadas/);
    expect(validateLabel({ kcal: 300, carbs: 10, sugars: 20 }).join(' ')).toMatch(/azúcares/);
  });
});
