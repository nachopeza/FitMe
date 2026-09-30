import type { Food, FoodCategory, FoodState, Nutrients, Portion, ProteinSource } from '../domain/types';

/**
 * Base de alimentos inicial, orientada a lo que el usuario come de verdad.
 *
 * Los valores son por 100 g de porción comestible y provienen de tablas de
 * composición de referencia (BEDCA / USDA FDC). Se redondean a un decimal:
 * más precisión sería falsa, porque el mismo alimento varía entre lotes.
 *
 * REGLA CLAVE: crudo y cocinado son alimentos distintos, con id distinto.
 * `cookedYield` permite convertir gramos crudos en cocinados sin inventar datos.
 */

type Row = {
  id: string;
  name: string;
  al?: string[];
  cat: FoodCategory;
  src?: ProteinSource;
  st?: FoodState;
  /** [kcal, proteína, carbohidratos, grasa, fibra, saturadas?, azúcares?, sodio mg?] */
  n: [number, number, number, number, number, number?, number?, number?];
  unit?: 'g' | 'ml';
  p?: Portion[];
  yield?: number;
  pair?: string;
  ferm?: 'low' | 'medium' | 'high';
  vol?: 'low' | 'medium' | 'high';
};

const P = (label: string, grams: number, isDefault = false): Portion => ({ label, grams, isDefault });

const ROWS: Row[] = [
  // ─────────────────────── Proteínas: aves y carnes ───────────────────────
  { id: 'pollo-pechuga-cruda', name: 'Pechuga de pollo (cruda)', al: ['pollo crudo', 'pechuga cruda'], cat: 'protein', src: 'poultry', st: 'raw', n: [120, 23, 0, 2.6, 0, 0.7, 0, 65], yield: 0.72, pair: 'pollo-pechuga-cocinada', vol: 'medium', p: [P('filete', 130, true)] },
  { id: 'pollo-pechuga-cocinada', name: 'Pechuga de pollo (cocinada)', al: ['pollo', 'pollo a la plancha', 'pechuga'], cat: 'protein', src: 'poultry', st: 'cooked', n: [165, 31, 0, 3.6, 0, 1, 0, 90], pair: 'pollo-pechuga-cruda', vol: 'medium', p: [P('filete', 100, true), P('ración', 150)] },
  { id: 'pollo-muslo-cocinado', name: 'Muslo de pollo (cocinado)', al: ['muslo', 'contramuslo'], cat: 'protein', src: 'poultry', st: 'cooked', n: [209, 26, 0, 11, 0, 3, 0, 95], p: [P('muslo', 110, true)] },
  { id: 'carne-picada-pollo-cruda', name: 'Carne picada de pollo (cruda)', al: ['picada de pollo cruda'], cat: 'protein', src: 'poultry', st: 'raw', n: [143, 20, 0, 7, 0, 2, 0, 75], yield: 0.75, pair: 'carne-picada-pollo-cocinada' },
  { id: 'carne-picada-pollo-cocinada', name: 'Carne picada de pollo (cocinada)', al: ['carne picada de pollo', 'picada de pollo', 'pollo picado'], cat: 'protein', src: 'poultry', st: 'cooked', n: [189, 27, 0, 9, 0, 2.6, 0, 95], pair: 'carne-picada-pollo-cruda', p: [P('ración', 120, true)] },
  { id: 'pavo-pechuga-cocinada', name: 'Pechuga de pavo (cocinada)', al: ['pavo'], cat: 'protein', src: 'poultry', st: 'cooked', n: [147, 30, 0, 2, 0, 0.6, 0, 105] },
  { id: 'carne-picada-mixta-cruda', name: 'Carne picada mixta (cruda)', al: ['picada cruda', 'carne picada cruda'], cat: 'protein', src: 'redMeat', st: 'raw', n: [206, 18.5, 0, 14.5, 0, 5.8, 0, 70], yield: 0.76, pair: 'carne-picada-mixta-cocinada' },
  { id: 'carne-picada-mixta-cocinada', name: 'Carne picada mixta (cocinada)', al: ['carne picada', 'picada', 'carne'], cat: 'protein', src: 'redMeat', st: 'cooked', n: [254, 25, 0, 17, 0, 6.8, 0, 90], pair: 'carne-picada-mixta-cruda', p: [P('ración', 120, true)] },
  { id: 'ternera-picada-5-cruda', name: 'Carne picada de ternera 5% (cruda)', al: ['picada magra'], cat: 'protein', src: 'redMeat', st: 'raw', n: [137, 21, 0, 5, 0, 2.2, 0, 70], yield: 0.75 },
  { id: 'entrecot-cocinado', name: 'Entrecot (cocinado)', al: ['entrecot', 'chuletón', 'filete de ternera'], cat: 'protein', src: 'redMeat', st: 'cooked', n: [271, 27, 0, 18, 0, 7.5, 0, 75], p: [P('pieza', 220, true)] },
  { id: 'ternera-filete-cocinado', name: 'Filete de ternera magro (cocinado)', al: ['ternera', 'filete'], cat: 'protein', src: 'redMeat', st: 'cooked', n: [197, 31, 0, 7.5, 0, 2.9, 0, 70], p: [P('filete', 130, true)] },
  { id: 'cerdo-lomo-cocinado', name: 'Lomo de cerdo (cocinado)', al: ['lomo', 'cerdo'], cat: 'protein', src: 'redMeat', st: 'cooked', n: [206, 30, 0, 9, 0, 3.2, 0, 70], p: [P('filete', 120, true)] },
  { id: 'jamon-serrano', name: 'Jamón serrano', al: ['jamón', 'jamon iberico', 'jamón ibérico'], cat: 'protein', src: 'redMeat', st: 'product', n: [241, 31, 0.3, 12.5, 0, 4.5, 0.3, 2300], p: [P('loncha', 15, true), P('ración', 60)] },
  { id: 'jamon-cocido', name: 'Jamón cocido / pavo en lonchas', al: ['jamón york', 'fiambre de pavo'], cat: 'protein', src: 'redMeat', st: 'product', n: [107, 18, 1.5, 3, 0, 1.1, 1.2, 1000], p: [P('loncha', 25, true)] },

  // ─────────────────────── Proteínas: pescado y marisco ───────────────────────
  { id: 'atun-natural', name: 'Atún al natural (lata, escurrido)', al: ['atún', 'atun en lata', 'atún al natural'], cat: 'protein', src: 'fish', st: 'product', n: [116, 26, 0, 1, 0, 0.3, 0, 320], p: [P('lata pequeña', 52, true), P('lata grande', 80)] },
  { id: 'atun-aceite', name: 'Atún en aceite de oliva (escurrido)', al: ['atún en aceite'], cat: 'protein', src: 'fish', st: 'product', n: [186, 25, 0, 9, 0, 1.5, 0, 350], p: [P('lata pequeña', 52, true)] },
  { id: 'anchoas', name: 'Anchoas en aceite', al: ['anchoa', 'boquerones en aceite'], cat: 'protein', src: 'fish', st: 'product', n: [210, 25, 0, 12, 0, 2.8, 0, 3600], p: [P('filete', 5, true), P('lata', 50)] },
  { id: 'langostinos-cocidos', name: 'Langostinos cocidos', al: ['langostino', 'gambas', 'camarones'], cat: 'protein', src: 'fish', st: 'cooked', n: [99, 21, 0.2, 1.2, 0, 0.3, 0, 700], p: [P('unidad', 12, true), P('ración', 120)] },
  { id: 'salmon-cocinado', name: 'Salmón (cocinado)', al: ['salmón'], cat: 'protein', src: 'fish', st: 'cooked', n: [208, 25, 0, 12, 0, 2.5, 0, 70], p: [P('lomo', 140, true)] },
  { id: 'merluza-cocinada', name: 'Merluza (cocinada)', al: ['merluza', 'pescado blanco'], cat: 'protein', src: 'fish', st: 'cooked', n: [104, 23, 0, 1, 0, 0.2, 0, 110], p: [P('lomo', 150, true)] },
  { id: 'bacalao-cocinado', name: 'Bacalao (cocinado)', al: ['bacalao'], cat: 'protein', src: 'fish', st: 'cooked', n: [105, 23, 0, 0.9, 0, 0.2, 0, 90] },
  { id: 'sardinas-lata', name: 'Sardinillas en aceite (escurridas)', al: ['sardinas'], cat: 'protein', src: 'fish', st: 'product', n: [208, 24, 0, 12, 0, 2.6, 0, 500], p: [P('lata', 60, true)] },

  // ─────────────────────── Huevos ───────────────────────
  { id: 'huevo', name: 'Huevo entero (M)', al: ['huevos', 'huevo', 'un huevo'], cat: 'protein', src: 'egg', st: 'asIs', n: [143, 12.6, 0.7, 9.5, 0, 3.1, 0.4, 140], p: [P('unidad', 55, true), P('unidad XL', 68)] },
  { id: 'huevo-clara', name: 'Clara de huevo', al: ['claras', 'clara'], cat: 'protein', src: 'egg', st: 'asIs', n: [52, 11, 0.7, 0.2, 0, 0, 0.7, 165], p: [P('clara', 33, true)] },
  { id: 'huevo-cocido', name: 'Huevo cocido', al: ['huevo duro'], cat: 'protein', src: 'egg', st: 'cooked', n: [155, 13, 1.1, 11, 0, 3.3, 1.1, 124], p: [P('unidad', 50, true)] },

  // ─────────────────────── Lácteos ───────────────────────
  { id: 'yogur-natural', name: 'Yogur natural', al: ['yogur', 'yogurt'], cat: 'dairy', src: 'dairy', st: 'product', n: [61, 3.5, 4.7, 3.3, 0, 2.1, 4.7, 46], p: [P('unidad', 125, true)] },
  { id: 'yogur-griego', name: 'Yogur griego', al: ['yogur griego', 'griego'], cat: 'dairy', src: 'dairy', st: 'product', n: [97, 9, 4, 5, 0, 3.3, 4, 36], p: [P('unidad', 150, true)] },
  { id: 'yogur-proteico', name: 'Yogur proteico (0% azúcares añadidos)', al: ['yogur proteico', 'skyr', 'yogur protein'], cat: 'dairy', src: 'dairy', st: 'product', n: [59, 10, 4, 0.2, 0, 0.1, 3.8, 50], p: [P('unidad', 150, true)] },
  { id: 'queso-batido', name: 'Queso batido 0%', al: ['queso batido', 'quark'], cat: 'dairy', src: 'dairy', st: 'product', n: [47, 8, 4, 0.2, 0, 0.1, 4, 40], p: [P('ración', 200, true)] },
  { id: 'requeson', name: 'Requesón / cottage', al: ['requesón', 'cottage'], cat: 'dairy', src: 'dairy', st: 'product', n: [98, 11, 3.4, 4.3, 0, 1.7, 2.7, 364], p: [P('ración', 100, true)] },
  { id: 'queso-curado', name: 'Queso curado', al: ['queso', 'queso viejo', 'manchego'], cat: 'dairy', src: 'dairy', st: 'product', n: [389, 27, 1.5, 31, 0, 19, 1, 1200], p: [P('loncha', 20, true), P('taco', 40)] },
  { id: 'queso-lonchas', name: 'Queso en lonchas semicurado', al: ['queso en lonchas', 'lonchas de queso'], cat: 'dairy', src: 'dairy', st: 'product', n: [330, 24, 1.5, 25, 0, 15.5, 1, 1400], p: [P('loncha', 20, true)] },
  { id: 'mozzarella', name: 'Mozzarella', al: ['mozzarella', 'mozarela'], cat: 'dairy', src: 'dairy', st: 'product', n: [250, 18, 2, 19, 0, 11, 1, 600], p: [P('bola', 125, true)] },
  { id: 'queso-feta', name: 'Queso feta / tipo griego', al: ['feta', 'queso griego'], cat: 'dairy', src: 'dairy', st: 'product', n: [264, 14, 4, 21, 0, 14, 4, 1100], p: [P('ración', 50, true)] },
  { id: 'queso-rallado', name: 'Queso rallado', al: ['queso rallado', 'parmesano'], cat: 'dairy', src: 'dairy', st: 'product', n: [380, 30, 2, 28, 0, 17, 1, 1500], p: [P('puñado', 25, true), P('cucharada', 10)] },
  { id: 'queso-fresco', name: 'Queso fresco batido tipo Burgos', al: ['queso fresco'], cat: 'dairy', src: 'dairy', st: 'product', n: [146, 12, 3, 9.5, 0, 6, 3, 300], p: [P('tarrina', 80, true)] },
  { id: 'leche-semi', name: 'Leche semidesnatada', al: ['leche'], cat: 'dairy', src: 'dairy', st: 'product', unit: 'ml', n: [46, 3.2, 4.8, 1.6, 0, 1, 4.8, 44], p: [P('vaso', 200, true), P('chorro café', 50)] },
  { id: 'leche-entera', name: 'Leche entera', al: ['leche entera'], cat: 'dairy', src: 'dairy', st: 'product', unit: 'ml', n: [63, 3.2, 4.7, 3.6, 0, 2.3, 4.7, 44], p: [P('vaso', 200, true)] },
  { id: 'bebida-soja', name: 'Bebida de soja (sin azúcar)', al: ['leche de soja', 'bebida de soja', 'soja'], cat: 'dairy', src: 'soy', st: 'product', unit: 'ml', n: [33, 3.3, 0.5, 1.8, 0.6, 0.3, 0.3, 40], p: [P('vaso', 200, true), P('chorro café', 60)] },

  // ─────────────────────── Proteína vegetal ───────────────────────
  { id: 'tofu', name: 'Tofu firme', al: ['tofu'], cat: 'protein', src: 'soy', st: 'asIs', n: [144, 15, 2.8, 8.7, 1.2, 1.3, 0.6, 14], p: [P('ración', 125, true)] },
  { id: 'soja-texturizada-seca', name: 'Soja texturizada (seca)', al: ['soja texturizada'], cat: 'protein', src: 'soy', st: 'raw', n: [330, 50, 17, 1.5, 18, 0.3, 4, 20], yield: 2.5, ferm: 'high' },
  { id: 'edamame-cocido', name: 'Edamame (cocido)', al: ['edamame'], cat: 'protein', src: 'soy', st: 'cooked', n: [121, 12, 4, 5, 5, 0.6, 2, 6], ferm: 'medium' },
  { id: 'lentejas-cocidas', name: 'Lentejas (cocidas)', al: ['lentejas'], cat: 'protein', src: 'legume', st: 'cooked', n: [105, 9, 12, 0.4, 8, 0.1, 1.8, 6], ferm: 'high', vol: 'high', p: [P('plato', 250, true)] },
  { id: 'garbanzos-cocidos', name: 'Garbanzos (cocidos)', al: ['garbanzos'], cat: 'protein', src: 'legume', st: 'cooked', n: [152, 9, 19, 2.6, 8, 0.3, 4.8, 7], ferm: 'high', vol: 'high', p: [P('plato', 220, true)] },
  { id: 'alubias-cocidas', name: 'Alubias blancas (cocidas)', al: ['alubias', 'judías blancas', 'frijoles'], cat: 'protein', src: 'legume', st: 'cooked', n: [119, 8.7, 16.6, 0.5, 6.4, 0.1, 0.3, 6], ferm: 'high', vol: 'high' },
  { id: 'proteina-whey', name: 'Proteína de suero en polvo', al: ['proteína', 'whey', 'batido de proteína'], cat: 'protein', src: 'supplement', st: 'product', n: [375, 78, 6, 5, 1, 2, 4, 350], p: [P('cacito', 30, true)], vol: 'low' },

  // ─────────────────────── Cereales y almidones ───────────────────────
  { id: 'arroz-crudo', name: 'Arroz blanco (crudo)', al: ['arroz crudo', 'arroz en seco'], cat: 'carb', src: 'cereal', st: 'raw', n: [355, 7, 78, 0.9, 1.4, 0.2, 0.1, 5], yield: 2.5, pair: 'arroz-cocido', p: [P('ración', 80, true), P('vaso', 180)] },
  { id: 'arroz-cocido', name: 'Arroz blanco (cocido)', al: ['arroz', 'arroz cocido', 'arroz hervido'], cat: 'carb', src: 'cereal', st: 'cooked', n: [130, 2.7, 28, 0.3, 0.4, 0.1, 0.1, 2], pair: 'arroz-crudo', vol: 'medium', p: [P('plato', 200, true), P('plato pequeño', 150), P('plato grande', 280)] },
  { id: 'arroz-integral-cocido', name: 'Arroz integral (cocido)', al: ['arroz integral'], cat: 'carb', src: 'cereal', st: 'cooked', n: [123, 2.7, 26, 1, 1.8, 0.2, 0.2, 4], ferm: 'medium', p: [P('plato', 200, true)] },
  { id: 'pasta-cruda', name: 'Pasta (cruda)', al: ['pasta cruda', 'macarrones crudos', 'espaguetis crudos'], cat: 'carb', src: 'cereal', st: 'raw', n: [359, 12.5, 71, 1.5, 3, 0.3, 3, 6], yield: 2.4, pair: 'pasta-cocida', p: [P('ración', 80, true)] },
  { id: 'pasta-cocida', name: 'Pasta (cocida)', al: ['pasta', 'macarrones', 'espaguetis', 'fideos'], cat: 'carb', src: 'cereal', st: 'cooked', n: [150, 5.2, 30, 0.6, 1.3, 0.1, 1.3, 3], pair: 'pasta-cruda', vol: 'medium', p: [P('plato', 200, true)] },
  { id: 'patata-cruda', name: 'Patata (cruda)', al: ['patata cruda'], cat: 'carb', src: 'cereal', st: 'raw', n: [77, 2, 17, 0.1, 2.2, 0, 0.8, 6], yield: 0.95, pair: 'patata-cocida' },
  { id: 'patata-cocida', name: 'Patata (cocida)', al: ['patata', 'patatas', 'patata hervida'], cat: 'carb', src: 'cereal', st: 'cooked', n: [86, 1.7, 20, 0.1, 1.8, 0, 0.9, 5], pair: 'patata-cruda', vol: 'high', p: [P('unidad mediana', 170, true)] },
  { id: 'boniato-cocido', name: 'Boniato (cocido)', al: ['boniato', 'batata'], cat: 'carb', src: 'cereal', st: 'cooked', n: [90, 2, 17.7, 0.1, 3.3, 0, 6.5, 36], vol: 'high' },
  { id: 'pan-blanco', name: 'Pan blanco', al: ['pan', 'barra de pan'], cat: 'carb', src: 'cereal', st: 'product', n: [265, 9, 49, 3.2, 2.7, 0.7, 5, 490], p: [P('rebanada', 30, true), P('trozo', 60), P('barra pequeña', 120)] },
  { id: 'pan-integral', name: 'Pan integral', al: ['pan integral'], cat: 'carb', src: 'cereal', st: 'product', n: [247, 10, 41, 3.4, 7, 0.7, 4, 450], ferm: 'medium', p: [P('rebanada', 35, true)] },
  { id: 'pan-molde', name: 'Pan de molde', al: ['pan de molde', 'pan bimbo'], cat: 'carb', src: 'cereal', st: 'product', n: [263, 8.5, 46, 4, 3, 0.9, 5, 480], p: [P('rebanada', 28, true)] },
  { id: 'tortilla-trigo', name: 'Tortilla de trigo (fajita)', al: ['tortilla de trigo', 'fajita', 'wrap', 'tortillas'], cat: 'carb', src: 'cereal', st: 'product', n: [304, 8, 50, 7.5, 3, 3, 2.5, 600], p: [P('unidad', 45, true), P('unidad grande', 62)] },
  { id: 'tortilla-maiz', name: 'Tortilla de maíz', al: ['tortilla de maíz', 'taco de maíz'], cat: 'carb', src: 'cereal', st: 'product', n: [218, 5.7, 40, 2.9, 5, 0.4, 1, 45], p: [P('unidad', 30, true)] },
  { id: 'avena', name: 'Copos de avena', al: ['avena', 'copos de avena', 'oats'], cat: 'carb', src: 'cereal', st: 'raw', n: [375, 13, 59, 7, 10, 1.2, 1, 5], ferm: 'medium', p: [P('ración', 60, true), P('cucharada', 12)] },
  { id: 'cereales-maiz', name: 'Cereales de maíz tostado', al: ['cereales', 'corn flakes'], cat: 'carb', src: 'cereal', st: 'product', n: [378, 7, 84, 0.9, 3, 0.2, 8, 600], vol: 'low', p: [P('ración', 40, true), P('tazón', 60)] },
  { id: 'cereales-chocolate', name: 'Cereales de chocolate', al: ['cereales de chocolate'], cat: 'carb', src: 'cereal', st: 'product', n: [400, 7.5, 76, 6, 5, 2.5, 25, 350], p: [P('ración', 45, true)] },
  { id: 'muesli', name: 'Muesli', al: ['muesli', 'granola'], cat: 'carb', src: 'cereal', st: 'product', n: [400, 10, 62, 11, 8, 2, 18, 20], ferm: 'medium', p: [P('ración', 50, true)] },
  { id: 'quinoa-cocida', name: 'Quinoa (cocida)', al: ['quinoa'], cat: 'carb', src: 'cereal', st: 'cooked', n: [120, 4.4, 21, 1.9, 2.8, 0.2, 0.9, 7], ferm: 'medium' },
  { id: 'cuscus-cocido', name: 'Cuscús (cocido)', al: ['cuscús', 'couscous'], cat: 'carb', src: 'cereal', st: 'cooked', n: [112, 3.8, 23, 0.2, 1.4, 0, 0.1, 5] },
  { id: 'pan-rallado', name: 'Pan rallado', al: ['pan rallado'], cat: 'carb', src: 'cereal', st: 'product', n: [350, 12, 66, 3, 4, 0.7, 4, 700], p: [P('cucharada', 12, true)] },

  // ─────────────────────── Fruta ───────────────────────
  { id: 'platano', name: 'Plátano', al: ['plátano', 'banana'], cat: 'fruit', st: 'asIs', n: [89, 1.1, 17.4, 0.3, 2.6, 0.1, 12, 1], p: [P('unidad', 120, true), P('unidad grande', 150)] },
  { id: 'manzana', name: 'Manzana', al: ['manzana'], cat: 'fruit', st: 'asIs', n: [52, 0.3, 9.6, 0.2, 2.4, 0, 9.6, 1], p: [P('unidad', 180, true)] },
  { id: 'naranja', name: 'Naranja', al: ['naranja'], cat: 'fruit', st: 'asIs', n: [44, 0.9, 8.4, 0.1, 2.4, 0, 8.4, 0], p: [P('unidad', 180, true)] },
  { id: 'mandarina', name: 'Mandarina', al: ['mandarina', 'mandarinas'], cat: 'fruit', st: 'asIs', n: [49, 0.8, 9.2, 0.3, 1.8, 0, 9.2, 2], p: [P('unidad', 90, true)] },
  { id: 'fresas', name: 'Fresas', al: ['fresa', 'fresas'], cat: 'fruit', st: 'asIs', n: [30, 0.7, 4.9, 0.3, 2, 0, 4.9, 1], p: [P('puñado', 100, true)] },
  { id: 'uvas', name: 'Uvas', al: ['uva', 'uvas'], cat: 'fruit', st: 'asIs', n: [69, 0.7, 16.1, 0.2, 0.9, 0.1, 16, 2], p: [P('puñado', 100, true)] },
  { id: 'kiwi', name: 'Kiwi', al: ['kiwi'], cat: 'fruit', st: 'asIs', n: [55, 1.1, 9, 0.5, 3, 0, 9, 3], p: [P('unidad', 90, true)] },
  { id: 'pera', name: 'Pera', al: ['pera'], cat: 'fruit', st: 'asIs', n: [48, 0.4, 9.7, 0.1, 3.1, 0, 9.7, 1], p: [P('unidad', 170, true)] },
  { id: 'sandia', name: 'Sandía', al: ['sandía'], cat: 'fruit', st: 'asIs', n: [30, 0.6, 6.8, 0.2, 0.4, 0, 6, 1], vol: 'high', p: [P('rodaja', 250, true)] },
  { id: 'melon', name: 'Melón', al: ['melón'], cat: 'fruit', st: 'asIs', n: [34, 0.8, 7.1, 0.2, 0.9, 0, 7.1, 16], vol: 'high' },
  { id: 'pina', name: 'Piña', al: ['piña'], cat: 'fruit', st: 'asIs', n: [50, 0.5, 9.6, 0.1, 1.4, 0, 9.6, 1] },
  { id: 'arandanos', name: 'Arándanos', al: ['arándanos'], cat: 'fruit', st: 'asIs', n: [52, 0.7, 9.6, 0.3, 2.4, 0, 9.6, 1], p: [P('puñado', 60, true)] },
  { id: 'datiles', name: 'Dátiles', al: ['dátil', 'dátiles'], cat: 'fruit', st: 'asIs', n: [275, 2.5, 63, 0.4, 8, 0, 63, 2], vol: 'low', p: [P('unidad', 8, true)] },
  { id: 'aguacate', name: 'Aguacate', al: ['aguacate'], cat: 'fat', st: 'asIs', n: [160, 2, 0, 15, 6.7, 2.1, 0, 7], vol: 'medium', p: [P('medio', 100, true), P('unidad', 200)] },

  // ─────────────────────── Verduras ───────────────────────
  { id: 'tomate', name: 'Tomate', al: ['tomate', 'tomates'], cat: 'vegetable', st: 'asIs', n: [18, 0.9, 2.7, 0.2, 1.2, 0, 2.6, 5], vol: 'high', p: [P('unidad', 150, true), P('rodaja', 20)] },
  { id: 'tomate-cherry', name: 'Tomates cherry', al: ['cherry', 'tomate cherry'], cat: 'vegetable', st: 'asIs', n: [18, 0.9, 2.7, 0.2, 1.2, 0, 2.6, 5], p: [P('puñado', 100, true)] },
  { id: 'tomate-frito', name: 'Tomate frito', al: ['tomate frito', 'salsa de tomate'], cat: 'vegetable', st: 'product', n: [82, 1.5, 9, 4, 1.5, 0.5, 7, 450], p: [P('cucharada', 20, true), P('ración', 70)] },
  { id: 'lechuga', name: 'Lechuga', al: ['lechuga', 'ensalada verde'], cat: 'vegetable', st: 'asIs', n: [15, 1.4, 0, 0.2, 1.3, 0, 0, 28], vol: 'high', p: [P('plato', 80, true)] },
  { id: 'pimiento-verde', name: 'Pimiento verde', al: ['pimiento verde', 'pimientos'], cat: 'vegetable', st: 'asIs', n: [20, 0.9, 2.9, 0.2, 1.7, 0, 2.4, 3], vol: 'high', p: [P('unidad', 120, true)] },
  { id: 'pimiento-rojo', name: 'Pimiento rojo', al: ['pimiento rojo'], cat: 'vegetable', st: 'asIs', n: [31, 1, 3.9, 0.3, 2.1, 0, 3.9, 4], p: [P('unidad', 120, true)] },
  { id: 'piquillo', name: 'Pimientos de piquillo (conserva)', al: ['piquillo', 'pimientos de piquillo'], cat: 'vegetable', st: 'product', n: [32, 1.2, 3.7, 0.3, 1.8, 0, 3.7, 300], p: [P('unidad', 25, true), P('lata', 150)] },
  { id: 'champinones', name: 'Champiñones', al: ['champiñones', 'champiñón', 'setas'], cat: 'vegetable', st: 'asIs', n: [22, 3.1, 2.3, 0.3, 1, 0, 2, 5], ferm: 'medium', vol: 'high', p: [P('ración', 150, true)] },
  { id: 'cebolla', name: 'Cebolla', al: ['cebolla'], cat: 'vegetable', st: 'asIs', n: [40, 1.1, 7.6, 0.1, 1.7, 0, 4.2, 4], ferm: 'high', p: [P('unidad', 120, true)] },
  { id: 'calabacin', name: 'Calabacín', al: ['calabacín'], cat: 'vegetable', st: 'asIs', n: [17, 1.2, 2.1, 0.3, 1, 0, 2.1, 8], vol: 'high' },
  { id: 'brocoli', name: 'Brócoli', al: ['brócoli', 'brocoli'], cat: 'vegetable', st: 'asIs', n: [34, 2.8, 4, 0.4, 2.6, 0, 1.7, 33], ferm: 'high', vol: 'high' },
  { id: 'judias-verdes', name: 'Judías verdes', al: ['judías verdes'], cat: 'vegetable', st: 'cooked', n: [31, 1.8, 3.6, 0.1, 3.4, 0, 3.3, 6], ferm: 'medium', vol: 'high' },
  { id: 'zanahoria', name: 'Zanahoria', al: ['zanahoria'], cat: 'vegetable', st: 'asIs', n: [41, 0.9, 6.8, 0.2, 2.8, 0, 4.7, 69], vol: 'high' },
  { id: 'espinacas', name: 'Espinacas', al: ['espinacas'], cat: 'vegetable', st: 'asIs', n: [23, 2.9, 1.4, 0.4, 2.2, 0, 0.4, 79], vol: 'high' },
  { id: 'pepino', name: 'Pepino', al: ['pepino'], cat: 'vegetable', st: 'asIs', n: [15, 0.7, 3.1, 0.1, 0.5, 0, 1.7, 2], vol: 'high' },
  { id: 'maiz-dulce', name: 'Maíz dulce (conserva)', al: ['maíz'], cat: 'vegetable', st: 'product', n: [86, 3, 16.3, 1.2, 2.7, 0.2, 6, 250], p: [P('puñado', 70, true)] },
  { id: 'esparragos', name: 'Espárragos', al: ['espárragos'], cat: 'vegetable', st: 'product', n: [20, 2.2, 1.8, 0.1, 2.1, 0, 1.8, 300] },
  { id: 'berenjena', name: 'Berenjena', al: ['berenjena'], cat: 'vegetable', st: 'asIs', n: [25, 1, 2.9, 0.2, 3, 0, 2.9, 2], vol: 'high' },
  { id: 'aceitunas', name: 'Aceitunas verdes', al: ['aceitunas', 'olivas'], cat: 'fat', st: 'product', n: [145, 1, 0.5, 15, 3.3, 2, 0.5, 1550], p: [P('unidad', 4, true), P('puñado', 30)] },

  // ─────────────────────── Grasas y frutos secos ───────────────────────
  { id: 'aceite-oliva', name: 'Aceite de oliva virgen extra', al: ['aceite', 'aceite de oliva', 'aove'], cat: 'fat', st: 'product', unit: 'ml', n: [884, 0, 0, 100, 0, 14, 0, 2], vol: 'low', p: [P('cucharada', 10, true), P('chorro', 15)] },
  { id: 'mantequilla', name: 'Mantequilla', al: ['mantequilla'], cat: 'fat', st: 'product', n: [717, 0.9, 0.1, 81, 0, 51, 0.1, 11], p: [P('porción', 10, true)] },
  { id: 'mayonesa', name: 'Mayonesa', al: ['mayonesa'], cat: 'fat', st: 'product', n: [680, 1, 1.5, 75, 0, 6, 1.5, 600], p: [P('cucharada', 15, true)] },
  { id: 'almendras', name: 'Almendras', al: ['almendras'], cat: 'fat', st: 'asIs', n: [579, 21, 4.6, 50, 12.5, 3.8, 4.4, 1], vol: 'low', p: [P('puñado', 30, true)] },
  { id: 'nueces', name: 'Nueces', al: ['nueces', 'nuez'], cat: 'fat', st: 'asIs', n: [663, 15.2, 3.3, 65, 6.7, 6.1, 2.6, 2], vol: 'low', p: [P('puñado', 30, true)] },
  { id: 'cacahuetes', name: 'Cacahuetes', al: ['cacahuetes'], cat: 'fat', st: 'asIs', n: [567, 26, 7.5, 49, 8.5, 6.3, 4, 18], vol: 'low', p: [P('puñado', 30, true)] },
  { id: 'crema-cacahuete', name: 'Crema de cacahuete', al: ['crema de cacahuete', 'mantequilla de cacahuete', 'peanut butter'], cat: 'fat', st: 'product', n: [615, 26, 12, 50, 6, 10, 9, 17], vol: 'low', p: [P('cucharada', 18, true)] },
  { id: 'pipas-girasol', name: 'Pipas de girasol peladas', al: ['pipas'], cat: 'fat', st: 'asIs', n: [584, 21, 11.4, 51, 8.6, 4.5, 2.6, 9], p: [P('puñado', 25, true)] },
  { id: 'chocolate-negro', name: 'Chocolate negro 85%', al: ['chocolate negro', 'chocolate'], cat: 'other', st: 'product', n: [580, 12.5, 19, 46, 15, 28, 10, 20], vol: 'low', p: [P('onza', 10, true)] },

  // ─────────────────────── Bebidas y otros ───────────────────────
  { id: 'cafe', name: 'Café solo', al: ['café', 'cafe', 'café solo', 'expreso'], cat: 'drink', st: 'asIs', unit: 'ml', n: [2, 0.1, 0, 0, 0, 0, 0, 2], p: [P('taza', 60, true), P('taza grande', 200)] },
  { id: 'te', name: 'Té / infusión', al: ['té', 'te', 'infusión'], cat: 'drink', st: 'asIs', unit: 'ml', n: [1, 0, 0.2, 0, 0, 0, 0, 3], p: [P('taza', 240, true)] },
  { id: 'cacao-desgrasado', name: 'Cacao puro desgrasado 0%', al: ['cacao', 'cacao 0%', 'cacao puro'], cat: 'other', st: 'product', n: [300, 25, 11, 10.5, 30, 6.3, 0.8, 20], ferm: 'medium', p: [P('cucharada', 10, true)] },
  { id: 'maca', name: 'Maca en polvo', al: ['maca'], cat: 'other', st: 'product', n: [325, 14, 62, 1.2, 7, 0.2, 30, 19], p: [P('cucharadita', 5, true)] },
  { id: 'miel', name: 'Miel', al: ['miel'], cat: 'other', st: 'product', n: [320, 0.3, 80, 0, 0.2, 0, 80, 4], p: [P('cucharada', 20, true)] },
  { id: 'azucar', name: 'Azúcar', al: ['azúcar'], cat: 'other', st: 'product', n: [400, 0, 100, 0, 0, 0, 100, 0], p: [P('cucharadita', 5, true)] },
  { id: 'ketchup', name: 'Ketchup', al: ['ketchup'], cat: 'other', st: 'product', n: [102, 1.3, 24, 0.2, 0.4, 0, 21, 900], p: [P('cucharada', 17, true)] },
  { id: 'salsa-soja', name: 'Salsa de soja', al: ['salsa de soja', 'soy sauce'], cat: 'other', src: 'soy', st: 'product', unit: 'ml', n: [53, 8, 4.9, 0.1, 0.8, 0, 0.4, 5500], p: [P('cucharada', 15, true)] },
];

function toNutrients(n: Row['n']): Nutrients {
  return {
    kcal: n[0],
    protein: n[1],
    carbs: n[2],
    fat: n[3],
    fiber: n[4],
    satFat: n[5] ?? 0,
    sugars: n[6] ?? 0,
    sodium: n[7] ?? 0,
  };
}

function expand(row: Row): Food {
  const unit = row.unit ?? 'g';
  const portions = row.p?.length ? row.p : [P(unit === 'ml' ? '100 ml' : '100 g', 100, true)];
  return {
    id: row.id,
    name: row.name,
    aliases: row.al ?? [],
    state: row.st ?? 'asIs',
    category: row.cat,
    proteinSource: row.src ?? 'none',
    per100g: toNutrients(row.n),
    unit,
    portions,
    cookedYield: row.yield,
    counterpartId: row.pair,
    fermentability: row.ferm ?? 'low',
    volumeIndex: row.vol ?? 'medium',
    custom: false,
  };
}

export const SEED_FOODS: Food[] = ROWS.map(expand);

/** Versión del seed: al subirla, la base se re-siembra sin tocar datos del usuario. */
export const SEED_VERSION = 1;
