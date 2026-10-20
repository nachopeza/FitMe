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

  { id: 'leche-desnatada', name: 'Leche desnatada', al: ['leche desnatada'], cat: 'dairy', src: 'dairy', st: 'product', unit: 'ml', n: [35, 3.4, 4.9, 0.2, 0, 0.1, 4.9, 44], p: [P('vaso', 200, true), P('chorro café', 50)] },
  { id: 'bebida-avena', name: 'Bebida de avena', al: ['leche de avena', 'bebida de avena', 'avena liquida'], cat: 'dairy', src: 'cereal', st: 'product', unit: 'ml', n: [46, 0.8, 7.6, 1.3, 0.8, 0.2, 4.1, 45], p: [P('vaso', 200, true), P('chorro café', 60)] },
  { id: 'mermelada', name: 'Mermelada', al: ['mermelada', 'confitura'], cat: 'other', st: 'product', n: [245, 0.4, 60, 0.1, 0.8, 0, 58, 12], p: [P('cucharada', 20, true)] },
  { id: 'queso-untable', name: 'Queso untable', al: ['queso untable', 'philadelphia', 'queso de untar'], cat: 'dairy', src: 'dairy', st: 'product', n: [253, 6, 4, 23, 0, 15, 4, 390], p: [P('cucharada', 20, true)] },
  { id: 'edulcorante', name: 'Edulcorante', al: ['sacarina', 'edulcorante', 'estevia'], cat: 'other', st: 'product', n: [0, 0, 0, 0, 0, 0, 0, 0], p: [P('sobre', 1, true)] },
  { id: 'proteina-caseina', name: 'Caseína en polvo', al: ['caseina', 'caseína'], cat: 'protein', src: 'supplement', st: 'product', n: [360, 77, 5, 2, 1, 1, 3, 400], p: [P('cacito', 30, true)], vol: 'low' },
  // ─────────────────────── Cereales y almidones ───────────────────────
  { id: 'arroz-crudo', name: 'Arroz blanco (crudo)', al: ['arroz crudo', 'arroz en seco'], cat: 'carb', src: 'cereal', st: 'raw', n: [355, 7, 78, 0.9, 1.4, 0.2, 0.1, 5], yield: 2.5, pair: 'arroz-cocido', p: [P('ración', 80, true), P('vaso', 180)] },
  { id: 'arroz-cocido', name: 'Arroz blanco (cocido)', al: ['arroz', 'arroz cocido', 'arroz hervido'], cat: 'carb', src: 'cereal', st: 'cooked', n: [130, 2.7, 28, 0.3, 0.4, 0.1, 0.1, 2], pair: 'arroz-crudo', vol: 'medium', p: [P('plato', 200, true), P('plato pequeño', 150), P('plato grande', 280)] },
  { id: 'arroz-integral-cocido', name: 'Arroz integral (cocido)', al: ['arroz integral'], cat: 'carb', src: 'cereal', st: 'cooked', n: [123, 2.7, 26, 1, 1.8, 0.2, 0.2, 4], ferm: 'medium', p: [P('plato', 200, true)] },
  { id: 'pasta-cruda', name: 'Pasta (cruda)', al: ['pasta cruda', 'macarrones crudos', 'espaguetis crudos', 'espirales crudos', 'fusilli crudo'], cat: 'carb', src: 'cereal', st: 'raw', n: [359, 12.5, 71, 1.5, 3, 0.3, 3, 6], yield: 2.4, pair: 'pasta-cocida', p: [P('ración', 80, true)] },
  { id: 'pasta-cocida', name: 'Pasta (cocida)', al: ['pasta', 'macarrones', 'espaguetis', 'fideos', 'espirales', 'fusilli', 'helices', 'hélices',
    'plumas', 'penne', 'lazos', 'tiburones', 'coditos', 'tallarines', 'farfalle', 'rigatoni', 'spaghetti'], cat: 'carb', src: 'cereal', st: 'cooked', n: [150, 5.2, 30, 0.6, 1.3, 0.1, 1.3, 3], pair: 'pasta-cruda', vol: 'medium', p: [P('plato', 200, true)] },
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
  { id: 'aguacate', name: 'Aguacate', al: ['aguacate', 'palta'], cat: 'fat', st: 'asIs', n: [160, 2, 1.8, 15, 6.7, 2.1, 0.7, 7], vol: 'medium', p: [P('medio', 100, true), P('unidad', 200)] },

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
  // Mezcla genérica: es lo que se dice de verdad ("un puñado de frutos secos")
  // cuando el bote de casa lleva almendras, nueces y anacardos mezclados. Los
  // valores son la media de esos tres, no los de ninguno en concreto.
  { id: 'frutos-secos', name: 'Frutos secos variados', al: ['frutos secos', 'frutos secos variados', 'mezcla de frutos secos', 'mix de frutos secos'], cat: 'fat', st: 'asIs', n: [607, 18.5, 8.5, 54, 8.5, 5.5, 4, 3], vol: 'low', p: [P('puñado', 30, true), P('puñado generoso', 45)] },
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
  // ─────────────────────── Ampliación: lo que hay en el súper ───────────────────────
  // Añadido después de ver que faltaba lo más corriente de una compra normal.
  // Mismo convenio europeo: los hidratos van sin la fibra.

  // Pasta, ñoquis y guarniciones
  { id: 'nioquis', name: 'Ñoquis de patata', al: ['ñoquis', 'nioquis', 'gnocchi', 'noquis'], cat: 'carb', src: 'cereal', st: 'product', n: [165, 4.2, 33, 1.2, 2, 0.3, 1, 290], vol: 'medium', p: [P('ración', 250, true), P('paquete', 500)] },
  { id: 'pasta-integral-cruda', name: 'Pasta integral (cruda)', al: ['pasta integral cruda'], cat: 'carb', src: 'cereal', st: 'raw', n: [348, 13, 62, 2.5, 9, 0.5, 3, 8], yield: 2.4, pair: 'pasta-integral-cocida', p: [P('ración', 80, true)] },
  { id: 'pasta-integral-cocida', name: 'Pasta integral (cocida)', al: ['pasta integral', 'macarrones integrales', 'espirales integrales'], cat: 'carb', src: 'cereal', st: 'cooked', n: [124, 5, 22, 1, 3.5, 0.2, 1, 3], pair: 'pasta-integral-cruda', ferm: 'medium', p: [P('plato', 200, true)] },
  { id: 'pasta-fresca-rellena', name: 'Pasta fresca rellena', al: ['raviolis', 'tortellini', 'pasta rellena', 'ravioli'], cat: 'carb', src: 'cereal', st: 'product', n: [268, 11, 35, 8.5, 2.2, 3.5, 2, 420], p: [P('ración', 125, true)] },
  { id: 'pasta-legumbres-cocida', name: 'Pasta de legumbres (cocida)', al: ['pasta de lentejas', 'pasta de garbanzos', 'pasta proteica'], cat: 'carb', src: 'legume', st: 'cooked', n: [157, 11, 21, 1.2, 4.5, 0.2, 1.5, 5], ferm: 'high', p: [P('plato', 200, true)] },
  { id: 'noodles-cocidos', name: 'Noodles (cocidos)', al: ['noodles', 'fideos chinos', 'ramen'], cat: 'carb', src: 'cereal', st: 'cooked', n: [138, 4.5, 25, 2, 1.2, 0.4, 0.5, 180], p: [P('plato', 200, true)] },
  { id: 'arroz-integral-crudo', name: 'Arroz integral (crudo)', al: ['arroz integral crudo'], cat: 'carb', src: 'cereal', st: 'raw', n: [355, 7.9, 72, 2.9, 3.5, 0.6, 0.9, 5], yield: 2.6, pair: 'arroz-integral-cocido', p: [P('ración', 70, true)] },
  { id: 'pure-patata', name: 'Puré de patata (preparado)', al: ['puré de patata', 'pure de patata', 'puré'], cat: 'carb', src: 'cereal', st: 'product', n: [85, 2, 13, 2.6, 1.3, 1.6, 1.4, 240], vol: 'high', p: [P('plato', 250, true)] },
  { id: 'patatas-horno', name: 'Patatas de horno (congeladas)', al: ['patatas fritas de horno', 'patatas congeladas', 'gajos'], cat: 'carb', src: 'cereal', st: 'product', n: [150, 2.4, 23, 4.8, 2.6, 0.5, 0.4, 230], p: [P('ración', 150, true)] },

  // Panes y bollería
  { id: 'pan-pita', name: 'Pan de pita', al: ['pita', 'pan pita'], cat: 'carb', src: 'cereal', st: 'product', n: [275, 9, 51, 1.2, 2.4, 0.2, 2, 480], p: [P('unidad', 60, true)] },
  { id: 'biscotes', name: 'Tostadas / biscotes', al: ['biscote', 'pan tostado', 'tostadas de pan'], cat: 'carb', src: 'cereal', st: 'product', n: [395, 12, 70, 6, 4, 0.8, 5, 500], p: [P('rebanada', 10, true)] },
  { id: 'pan-hamburguesa', name: 'Pan de hamburguesa', al: ['pan de burger', 'bollo de hamburguesa'], cat: 'carb', src: 'cereal', st: 'product', n: [280, 9, 48, 4.5, 2.5, 1, 6, 480], p: [P('unidad', 60, true)] },
  { id: 'croissant', name: 'Croissant', al: ['cruasán', 'cruasan', 'napolitana'], cat: 'carb', src: 'cereal', st: 'product', n: [406, 8, 42, 21, 2.5, 13, 9, 420], p: [P('unidad', 60, true)] },
  { id: 'harina-trigo', name: 'Harina de trigo', al: ['harina'], cat: 'carb', src: 'cereal', st: 'raw', n: [364, 10, 73, 1, 2.7, 0.2, 0.3, 2], p: [P('cucharada', 10, true)] },

  // Carnes y embutidos
  { id: 'salchichas-frankfurt', name: 'Salchichas tipo Frankfurt', al: ['salchichas', 'frankfurt'], cat: 'protein', src: 'redMeat', st: 'product', n: [269, 11, 2.5, 24, 0, 9, 1.5, 900], p: [P('unidad', 25, true)] },
  { id: 'chorizo', name: 'Chorizo', al: ['chorizo'], cat: 'protein', src: 'redMeat', st: 'product', n: [455, 24, 2, 38, 0, 14, 1, 1600], p: [P('loncha', 10, true)] },
  { id: 'bacon', name: 'Bacon (cocinado)', al: ['bacon', 'beicon', 'panceta'], cat: 'protein', src: 'redMeat', st: 'cooked', n: [410, 29, 1, 32, 0, 11, 0, 1800], p: [P('loncha', 12, true)] },
  { id: 'hamburguesa-ternera-cruda', name: 'Hamburguesa de ternera (cruda)', al: ['hamburguesa cruda', 'burger meat'], cat: 'protein', src: 'redMeat', st: 'raw', n: [220, 18, 1, 16, 0, 7, 0.5, 350], yield: 0.75, p: [P('unidad', 120, true)] },
  { id: 'albondigas', name: 'Albóndigas (cocinadas)', al: ['albóndigas', 'albondigas'], cat: 'protein', src: 'redMeat', st: 'cooked', n: [220, 15, 8, 14, 1, 5, 1.5, 600], p: [P('unidad', 25, true)] },
  { id: 'pollo-empanado', name: 'Pollo empanado (cocinado)', al: ['pollo empanado', 'nuggets', 'san jacobo', 'fingers de pollo'], cat: 'protein', src: 'poultry', st: 'cooked', n: [240, 17, 16, 12, 1, 2, 1, 520], p: [P('ración', 120, true)] },

  // Pescados y conservas
  { id: 'salmon-ahumado', name: 'Salmón ahumado', al: ['salmón ahumado', 'salmon ahumado'], cat: 'protein', src: 'fish', st: 'product', n: [180, 22, 0, 10, 0, 2, 0, 1200], p: [P('loncha', 20, true), P('sobre', 100)] },
  { id: 'caballa-aceite', name: 'Caballa en aceite (escurrida)', al: ['caballa', 'melva'], cat: 'protein', src: 'fish', st: 'product', n: [220, 22, 0, 15, 0, 3, 0, 420], p: [P('lata', 80, true)] },
  { id: 'mejillones-escabeche', name: 'Mejillones en escabeche (escurridos)', al: ['mejillones', 'mejillones en lata'], cat: 'protein', src: 'fish', st: 'product', n: [150, 17, 4, 7, 0, 1.2, 0.5, 600], p: [P('lata', 70, true)] },
  { id: 'surimi', name: 'Palitos de cangrejo (surimi)', al: ['surimi', 'palitos de cangrejo', 'palitos de mar'], cat: 'protein', src: 'fish', st: 'product', n: [95, 8, 14, 0.5, 0, 0.1, 4, 800], p: [P('unidad', 17, true)] },
  { id: 'atun-fresco', name: 'Atún fresco (cocinado)', al: ['atún fresco', 'lomo de atún'], cat: 'protein', src: 'fish', st: 'cooked', n: [184, 30, 0, 6, 0, 1.6, 0, 50], p: [P('ración', 150, true)] },

  // Vegetales proteicos
  { id: 'seitan', name: 'Seitán', al: ['seitán', 'seitan'], cat: 'protein', src: 'cereal', st: 'product', n: [145, 24, 4, 1.5, 1, 0.3, 0.5, 400], p: [P('ración', 100, true)] },
  { id: 'hummus', name: 'Hummus', al: ['hummus', 'humus'], cat: 'fat', src: 'legume', st: 'product', n: [230, 7, 12, 17, 5, 2.3, 0.5, 400], ferm: 'high', p: [P('cucharada', 25, true), P('tarrina', 200)] },

  // Lácteos y postres
  { id: 'kefir', name: 'Kéfir natural', al: ['kéfir', 'kefir'], cat: 'dairy', src: 'dairy', st: 'product', unit: 'ml', n: [62, 3.4, 4.5, 3.3, 0, 2.1, 4.5, 50], p: [P('vaso', 200, true)] },
  { id: 'yogur-sabores', name: 'Yogur de sabores', al: ['yogur de fresa', 'yogur de limón', 'yogur de sabores'], cat: 'dairy', src: 'dairy', st: 'product', n: [85, 3.2, 12, 2.5, 0, 1.6, 12, 50], p: [P('unidad', 125, true)] },
  { id: 'petit-suisse', name: 'Petit suisse', al: ['petit', 'petit suisse', 'danonino'], cat: 'dairy', src: 'dairy', st: 'product', n: [145, 6, 14, 6.5, 0, 4, 13, 60], p: [P('unidad', 55, true)] },
  { id: 'natillas', name: 'Natillas / flan', al: ['natillas', 'flan'], cat: 'dairy', src: 'dairy', st: 'product', n: [120, 3.2, 18, 3.5, 0, 2.2, 16, 65], p: [P('unidad', 125, true)] },
  { id: 'helado-vainilla', name: 'Helado de vainilla', al: ['helado'], cat: 'dairy', src: 'dairy', st: 'product', n: [200, 3.5, 23, 10, 0.5, 6.5, 21, 80], p: [P('bola', 50, true), P('tarrina', 100)] },
  { id: 'nata-cocinar', name: 'Nata para cocinar 18%', al: ['nata', 'nata líquida'], cat: 'dairy', src: 'dairy', st: 'product', unit: 'ml', n: [185, 2.5, 3.5, 18, 0, 12, 3.5, 40], p: [P('cucharada', 15, true)] },
  { id: 'bebida-almendras', name: 'Bebida de almendras (sin azúcar)', al: ['leche de almendras', 'bebida de almendra'], cat: 'dairy', src: 'none', st: 'product', unit: 'ml', n: [13, 0.5, 0.1, 1.1, 0.3, 0.1, 0.1, 60], p: [P('vaso', 200, true)] },

  // Verduras y hortalizas
  { id: 'guisantes', name: 'Guisantes (cocidos)', al: ['guisantes'], cat: 'vegetable', src: 'legume', st: 'cooked', n: [84, 5.4, 9, 0.4, 5, 0.1, 3, 3], ferm: 'medium', p: [P('ración', 150, true)] },
  { id: 'coliflor', name: 'Coliflor (cocida)', al: ['coliflor'], cat: 'vegetable', st: 'cooked', n: [25, 1.9, 2, 0.3, 2.3, 0.1, 1.9, 15], ferm: 'high', vol: 'high', p: [P('ración', 200, true)] },
  { id: 'repollo', name: 'Col / repollo', al: ['col', 'repollo', 'berza'], cat: 'vegetable', st: 'raw', n: [25, 1.3, 3.5, 0.1, 2.5, 0, 3.2, 18], ferm: 'high', vol: 'high' },
  { id: 'puerro', name: 'Puerro', al: ['puerro', 'puerros'], cat: 'vegetable', st: 'raw', n: [61, 1.5, 12, 0.3, 1.8, 0, 3.9, 20], ferm: 'high' },
  { id: 'ajo', name: 'Ajo', al: ['ajo', 'ajos', 'diente de ajo'], cat: 'vegetable', st: 'raw', n: [149, 6.4, 28, 0.5, 2.1, 0.1, 1, 17], ferm: 'high', p: [P('diente', 3, true)] },
  { id: 'alcachofa', name: 'Alcachofa (cocida)', al: ['alcachofa', 'alcachofas'], cat: 'vegetable', st: 'cooked', n: [53, 2.9, 6, 0.3, 5.7, 0.1, 1, 60], ferm: 'high', p: [P('unidad', 100, true)] },
  { id: 'remolacha', name: 'Remolacha (cocida)', al: ['remolacha'], cat: 'vegetable', st: 'cooked', n: [44, 1.7, 8, 0.2, 2, 0, 7.9, 80] },
  { id: 'calabaza', name: 'Calabaza (cocida)', al: ['calabaza'], cat: 'vegetable', st: 'cooked', n: [26, 1, 4.5, 0.1, 1.1, 0, 2.8, 1], vol: 'high', p: [P('ración', 200, true)] },
  { id: 'menestra', name: 'Menestra de verduras (congelada)', al: ['menestra', 'verduras congeladas', 'salteado de verduras'], cat: 'vegetable', st: 'cooked', n: [45, 2.8, 5, 0.4, 3, 0.1, 2.5, 25], vol: 'high', p: [P('ración', 200, true)] },
  { id: 'gazpacho', name: 'Gazpacho', al: ['gazpacho', 'salmorejo ligero'], cat: 'vegetable', st: 'product', unit: 'ml', n: [37, 0.7, 3, 2.3, 0.9, 0.3, 2.6, 300], vol: 'high', p: [P('vaso', 250, true)] },

  // Frutas
  { id: 'melocoton', name: 'Melocotón', al: ['melocotón', 'melocoton', 'nectarina', 'paraguayo'], cat: 'fruit', st: 'asIs', n: [39, 0.9, 8, 0.3, 1.5, 0, 8, 0], vol: 'high', p: [P('unidad', 150, true)] },
  { id: 'ciruela', name: 'Ciruela', al: ['ciruela', 'ciruelas'], cat: 'fruit', st: 'asIs', n: [46, 0.7, 10, 0.3, 1.4, 0, 9.9, 0], p: [P('unidad', 65, true)] },
  { id: 'cerezas', name: 'Cerezas', al: ['cerezas', 'picotas'], cat: 'fruit', st: 'asIs', n: [63, 1.1, 14, 0.2, 2.1, 0, 12.8, 0], p: [P('puñado', 100, true)] },
  { id: 'mango', name: 'Mango', al: ['mango'], cat: 'fruit', st: 'asIs', n: [60, 0.8, 13.4, 0.4, 1.6, 0.1, 13.4, 1], p: [P('unidad', 200, true)] },
  { id: 'granada', name: 'Granada', al: ['granada'], cat: 'fruit', st: 'asIs', n: [83, 1.7, 15, 1.2, 4, 0.1, 13.7, 3], p: [P('unidad', 175, true)] },
  { id: 'frutos-rojos-congelados', name: 'Frutos rojos (congelados)', al: ['frutos rojos', 'frutos del bosque', 'mora'], cat: 'fruit', st: 'asIs', n: [45, 0.9, 7, 0.4, 3.5, 0, 6.5, 2], p: [P('puñado', 100, true)] },

  // Snacks y dulces
  { id: 'galletas-maria', name: 'Galletas María', al: ['galletas maría', 'galletas maria', 'galletas'], cat: 'other', src: 'cereal', st: 'product', n: [430, 7, 72, 12, 2.5, 5, 20, 400], p: [P('unidad', 7, true)] },
  { id: 'galletas-chocolate', name: 'Galletas con chocolate', al: ['galletas de chocolate', 'cookies'], cat: 'other', src: 'cereal', st: 'product', n: [490, 6, 62, 23, 3, 13, 32, 350], p: [P('unidad', 15, true)] },
  { id: 'tortitas-arroz', name: 'Tortitas de arroz', al: ['tortitas de arroz', 'tortita de maíz'], cat: 'carb', src: 'cereal', st: 'product', n: [387, 8, 80, 3, 2, 0.6, 0.5, 20], vol: 'high', p: [P('unidad', 8, true)] },
  { id: 'barrita-proteina', name: 'Barrita de proteína', al: ['barrita proteica', 'barrita de proteína', 'protein bar'], cat: 'protein', src: 'supplement', st: 'product', n: [360, 32, 25, 12, 8, 6, 2, 300], p: [P('unidad', 60, true)] },
  { id: 'patatas-bolsa', name: 'Patatas fritas de bolsa', al: ['patatas de bolsa', 'patatas chips', 'chips'], cat: 'other', src: 'cereal', st: 'product', n: [535, 6, 50, 34, 4, 3.5, 0.5, 500], vol: 'low', p: [P('puñado', 30, true), P('bolsa', 150)] },
  { id: 'palomitas', name: 'Palomitas', al: ['palomitas', 'popcorn'], cat: 'other', src: 'cereal', st: 'product', n: [480, 8, 50, 26, 9, 12, 1, 600], p: [P('bol', 40, true)] },
  { id: 'crema-cacao', name: 'Crema de cacao con avellanas', al: ['nocilla', 'nutella', 'crema de cacao'], cat: 'other', st: 'product', n: [539, 6.3, 56, 31, 3.4, 10.6, 55, 40], vol: 'low', p: [P('cucharada', 15, true)] },

  // Platos preparados y salsas
  { id: 'pizza-margarita', name: 'Pizza margarita (horneada)', al: ['pizza', 'pizza margarita'], cat: 'carb', src: 'cereal', st: 'product', n: [250, 10, 30, 9, 2, 4, 3, 550], p: [P('pizza entera', 350, true), P('porción', 90)] },
  { id: 'mostaza', name: 'Mostaza', al: ['mostaza'], cat: 'other', st: 'product', n: [66, 4, 5, 3, 3, 0.2, 1, 1100], p: [P('cucharadita', 5, true)] },
  { id: 'vinagre-balsamico', name: 'Vinagre balsámico', al: ['vinagre balsámico', 'vinagre de módena', 'vinagre'], cat: 'other', st: 'product', unit: 'ml', n: [88, 0.5, 17, 0, 0, 0, 15, 23], p: [P('cucharada', 15, true)] },
  { id: 'caldo-pollo', name: 'Caldo de pollo', al: ['caldo', 'caldo de pollo', 'consomé'], cat: 'other', st: 'product', unit: 'ml', n: [6, 0.8, 0.5, 0.2, 0, 0, 0.3, 320], vol: 'high', p: [P('taza', 250, true)] },

  // Bebidas
  { id: 'zumo-naranja', name: 'Zumo de naranja', al: ['zumo de naranja', 'zumo'], cat: 'drink', st: 'product', unit: 'ml', n: [45, 0.7, 8.9, 0.2, 0.2, 0, 8.3, 1], p: [P('vaso', 200, true)] },
  { id: 'refresco-cola', name: 'Refresco de cola', al: ['coca cola', 'refresco', 'cola'], cat: 'drink', st: 'product', unit: 'ml', n: [42, 0, 10.6, 0, 0, 0, 10.6, 4], p: [P('lata', 330, true)] },
  { id: 'refresco-zero', name: 'Refresco de cola zero', al: ['coca cola zero', 'refresco zero', 'refresco light'], cat: 'drink', st: 'product', unit: 'ml', n: [0.3, 0, 0, 0, 0, 0, 0, 10], p: [P('lata', 330, true)] },
  { id: 'bebida-isotonica', name: 'Bebida isotónica', al: ['isotónica', 'aquarius', 'bebida deportiva'], cat: 'drink', st: 'product', unit: 'ml', n: [24, 0, 6, 0, 0, 0, 5, 40], p: [P('botella', 500, true)] },
  // El alcohol aporta 7 kcal/g y no es ninguno de los macros, así que en estas
  // dos la energía declarada no cuadra con proteína, hidratos y grasa. Es
  // correcto: lo que falta es el alcohol.
  { id: 'cerveza', name: 'Cerveza', al: ['cerveza', 'caña', 'tercio', 'birra'], cat: 'drink', st: 'product', unit: 'ml', n: [43, 0.5, 3.6, 0, 0, 0, 0.1, 4], p: [P('caña', 200, true), P('tercio', 330)] },
  { id: 'vino-tinto', name: 'Vino tinto', al: ['vino', 'vino tinto', 'copa de vino'], cat: 'drink', st: 'product', unit: 'ml', n: [85, 0.1, 2.6, 0, 0, 0, 0.6, 4], p: [P('copa', 150, true)] },
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
  const portions = row.p?.length ? row.p : [P(unit === 'ml' ? '100 ml' : '100 g', 100, true)
];
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
export const SEED_VERSION = 3;
