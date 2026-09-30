import { describe, expect, it } from 'vitest';
import { SEED_FOODS } from '../data/foods';
import { buildIndex, digitizeNumbers, normalize, parsePhrase, searchFoods, segment } from './parser';

const index = buildIndex(SEED_FOODS);
const parse = (s: string) => parsePhrase(s, index);
const ids = (s: string) => parse(s).items.map((i) => i.foodId);

describe('normalización', () => {
  it('quita acentos y puntuación', () => {
    expect(normalize('Café con Leche de Soja.')).toBe('cafe con leche de soja.');
  });
  it('convierte números escritos', () => {
    expect(digitizeNumbers('cien gramos de pollo')).toContain('100');
    expect(digitizeNumbers('ciento cincuenta gramos')).toContain('150');
    expect(digitizeNumbers('dos huevos')).toContain('2');
  });
  it('segmenta por comas, y, con', () => {
    expect(segment('arroz con pollo, dos huevos y tomate')).toHaveLength(4);
  });
});

describe('frase completa del usuario', () => {
  const phrase =
    'He comido arroz con unos cien gramos de carne picada de pollo, dos huevos, tomate aliñado y un café con leche de soja.';
  const result = parse(phrase);

  it('identifica los seis alimentos', () => {
    expect(result.items.map((i) => i.foodId)).toEqual([
      'arroz-cocido',
      'carne-picada-pollo-cocinada',
      'huevo',
      'tomate',
      'cafe',
      'bebida-soja',
    ]);
  });

  it('respeta los 100 g dichos en voz alta', () => {
    const carne = result.items.find((i) => i.foodId === 'carne-picada-pollo-cocinada')!;
    expect(carne.grams).toBe(100);
    // "unos cien gramos" lleva una muletilla: es estimación, no dato exacto.
    expect(carne.confidence).toBe('estimated');
  });

  it('cuenta dos huevos como dos unidades exactas', () => {
    const huevo = result.items.find((i) => i.foodId === 'huevo')!;
    expect(huevo.quantity).toBe(2);
    expect(huevo.grams).toBe(110);
    expect(huevo.confidence).toBe('exact');
  });

  it('marca como aproximado lo que no lleva cantidad', () => {
    const arroz = result.items.find((i) => i.foodId === 'arroz-cocido')!;
    expect(arroz.confidence).toBe('rough');
    expect(arroz.grams).toBe(200);
    expect(arroz.options).toContain(200);
  });

  it('no deja nada sin identificar', () => {
    expect(result.unmatched).toEqual([]);
  });
});

describe('crudo frente a cocinado', () => {
  it('por defecto asume cocinado, que es lo que se come', () => {
    expect(ids('100 g de arroz')).toEqual(['arroz-cocido']);
    expect(ids('150 g de pollo')).toEqual(['pollo-pechuga-cocinada']);
    expect(ids('pasta')).toEqual(['pasta-cocida']);
  });
  it('respeta "crudo" cuando se dice', () => {
    expect(ids('80 g de arroz crudo')).toEqual(['arroz-crudo']);
    expect(ids('100 g de pasta en seco')).toEqual(['pasta-cruda']);
  });
});

describe('especificidad del término', () => {
  it('prefiere el alimento más específico', () => {
    expect(ids('carne picada de pollo')).toEqual(['carne-picada-pollo-cocinada']);
    expect(ids('carne picada')).toEqual(['carne-picada-mixta-cocinada']);
    expect(ids('atún al natural')).toEqual(['atun-natural']);
    expect(ids('yogur griego')).toEqual(['yogur-griego']);
    expect(ids('pimientos de piquillo')).toEqual(['piquillo']);
  });
});

describe('unidades y raciones', () => {
  it('interpreta un plato como estimación, no como dato', () => {
    const arroz = parse('un plato de arroz').items[0];
    expect(arroz.grams).toBe(200);
    expect(arroz.confidence).toBe('estimated');
  });
  it('interpreta lonchas, latas y cucharadas', () => {
    expect(parse('dos lonchas de queso').items[0].grams).toBe(40);
    expect(parse('una lata de atún').items[0].grams).toBe(52);
    expect(parse('una cucharada de aceite').items[0].grams).toBe(10);
  });
  it('convierte kilos y mililitros', () => {
    expect(parse('0,2 kg de pollo').items[0].grams).toBeCloseTo(200);
    expect(parse('200 ml de bebida de soja').items[0].grams).toBe(200);
  });
  it('entiende medio', () => {
    expect(parse('medio aguacate').items[0].grams).toBe(50);
  });
});

describe('robustez', () => {
  it('suma el mismo alimento repetido', () => {
    const r = parse('100 g de pollo y 50 g de pollo');
    expect(r.items).toHaveLength(1);
    expect(r.items[0].grams).toBe(150);
  });
  it('detecta la comida si se menciona', () => {
    expect(parse('para cenar dos huevos').slot).toBe('dinner');
    expect(parse('de desayuno un café').slot).toBe('breakfast');
    expect(parse('he cenado atún con tomate').slot).toBe('dinner');
    expect(parse('he merendado un yogur').slot).toBe('snack');
    expect(parse('en la comida arroz con pollo').slot).toBe('lunch');
  });

  it('"he comido" NO significa almuerzo: es la forma normal de decir "he tomado"', () => {
    // Antes, dictar "he comido..." a las 21:00 clasificaba la cena como comida.
    expect(parse('he comido arroz con pollo').slot).toBeUndefined();
    expect(parse('he comido dos huevos y pan').slot).toBeUndefined();
  });
  it('reporta lo que no reconoce en vez de inventarlo', () => {
    const r = parse('un plato de zarangollo murciano');
    expect(r.items).toHaveLength(0);
    expect(r.unmatched.length).toBeGreaterThan(0);
  });
});

describe('buscador manual', () => {
  it('tolera acentos y plurales', () => {
    expect(searchFoods('platano', SEED_FOODS)[0].id).toBe('platano');
    expect(searchFoods('huevos', SEED_FOODS)[0].id).toBe('huevo');
    expect(searchFoods('piquillos', SEED_FOODS)[0].id).toBe('piquillo');
  });
  it('no devuelve nada con una consulta sin sentido', () => {
    expect(searchFoods('xyzqw', SEED_FOODS)).toHaveLength(0);
  });
});
