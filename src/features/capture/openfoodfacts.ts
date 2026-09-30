import type { Food, Nutrients, Portion } from '../../domain/types';

/**
 * Consulta de productos por código de barras en Open Food Facts.
 *
 * Es una base de datos abierta y colaborativa, gratuita y sin clave de API.
 * Cobertura muy buena en productos españoles. Su contrapartida es que los datos
 * los introducen personas: pueden faltar campos o estar mal, así que todo lo que
 * llega se marca como pendiente de revisar y el usuario confirma antes de guardar.
 */

const API = 'https://world.openfoodfacts.org/api/v2/product';

const FIELDS = [
  'code', 'product_name', 'product_name_es', 'brands', 'quantity',
  'serving_size', 'serving_quantity', 'nutriments', 'categories_tags',
].join(',');

interface OffNutriments {
  'energy-kcal_100g'?: number;
  energy_100g?: number;
  'energy-kj_100g'?: number;
  proteins_100g?: number;
  carbohydrates_100g?: number;
  fat_100g?: number;
  'saturated-fat_100g'?: number;
  sugars_100g?: number;
  fiber_100g?: number;
  sodium_100g?: number;
  salt_100g?: number;
}

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  brands?: string;
  quantity?: string;
  serving_size?: string;
  serving_quantity?: number | string;
  nutriments?: OffNutriments;
  categories_tags?: string[];
}

export interface BarcodeLookup {
  found: boolean;
  /** Alimento listo para revisar y guardar. */
  food?: Food;
  /** Campos que la base de datos no tenía: se piden a mano. */
  missing: string[];
  productName?: string;
  brand?: string;
}

export class OffLookupError extends Error {}

export async function lookupBarcode(barcode: string, signal?: AbortSignal): Promise<BarcodeLookup> {
  const code = barcode.replace(/\D/g, '');
  if (code.length < 8) throw new OffLookupError('El código leído no parece válido.');

  let res: Response;
  try {
    res = await fetch(`${API}/${encodeURIComponent(code)}.json?fields=${FIELDS}`, {
      signal,
      headers: { Accept: 'application/json' },
    });
  } catch {
    throw new OffLookupError(
      'No se ha podido consultar la base de datos de productos. Sin conexión puedes introducir los valores a mano.',
    );
  }

  if (res.status === 404) return { found: false, missing: [] };
  if (!res.ok) throw new OffLookupError(`La base de datos ha respondido con un error (${res.status}).`);

  const json = (await res.json()) as { status?: number; product?: OffProduct };
  const product = json.product;
  if (!product || json.status === 0) return { found: false, missing: [] };

  return mapProduct(product, code);
}

/** Convierte la respuesta de Open Food Facts en un alimento de FitMe. */
export function mapProduct(product: OffProduct, code: string): BarcodeLookup {
  const n = product.nutriments ?? {};
  const missing: string[] = [];

  let kcal = n['energy-kcal_100g'];
  if (kcal == null) {
    // Open Food Facts a veces solo trae la energía en kJ.
    const kj = n['energy-kj_100g'] ?? n.energy_100g;
    if (kj != null) kcal = Math.round(kj / 4.184);
  }
  if (kcal == null) missing.push('energía');

  const protein = n.proteins_100g;
  if (protein == null) missing.push('proteínas');
  const carbs = n.carbohydrates_100g;
  if (carbs == null) missing.push('hidratos de carbono');
  const fat = n.fat_100g;
  if (fat == null) missing.push('grasas');
  const fiber = n.fiber_100g;
  if (fiber == null) missing.push('fibra');

  const sodium =
    n.sodium_100g != null
      ? Math.round(n.sodium_100g * 1000)
      : n.salt_100g != null
        ? Math.round(n.salt_100g * 400)
        : 0;

  const per100g: Nutrients = {
    kcal: kcal ?? 0,
    protein: protein ?? 0,
    carbs: carbs ?? 0,
    fat: fat ?? 0,
    fiber: fiber ?? 0,
    satFat: n['saturated-fat_100g'] ?? 0,
    sugars: n.sugars_100g ?? 0,
    sodium,
  };

  const name = (product.product_name_es || product.product_name || '').trim();
  const brand = (product.brands ?? '').split(',')[0]?.trim();

  const portions: Portion[] = [];
  const servingGrams = parseServing(product.serving_quantity, product.serving_size);
  if (servingGrams) portions.push({ label: 'ración', grams: servingGrams, isDefault: true });
  portions.push({ label: '100 g', grams: 100, isDefault: !servingGrams });

  const food: Food = {
    id: `off-${code}`,
    name: name || `Producto ${code}`,
    aliases: [name, brand ? `${brand} ${name}` : ''].filter(Boolean),
    brand: brand || undefined,
    barcode: code,
    state: 'product',
    category: guessCategory(product.categories_tags ?? [], per100g),
    proteinSource: guessProteinSource(product.categories_tags ?? []),
    per100g,
    unit: /\bml\b|litro/i.test(product.quantity ?? '') ? 'ml' : 'g',
    portions,
    fermentability: 'low',
    volumeIndex: per100g.kcal > 250 ? 'low' : 'medium',
    custom: true,
    createdAt: Date.now(),
  };

  return { found: true, food, missing, productName: name || undefined, brand: brand || undefined };
}

function parseServing(quantity: number | string | undefined, size: string | undefined): number | null {
  if (typeof quantity === 'number' && quantity > 0) return Math.round(quantity);
  if (typeof quantity === 'string') {
    const v = parseFloat(quantity.replace(',', '.'));
    if (Number.isFinite(v) && v > 0) return Math.round(v);
  }
  if (size) {
    const m = size.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(g|ml)/i);
    if (m) return Math.round(parseFloat(m[1]));
  }
  return null;
}

function guessCategory(tags: string[], n: Nutrients): Food['category'] {
  const t = tags.join(' ');
  if (/dairy|yogurt|cheese|milk|lacteo/.test(t)) return 'dairy';
  if (/meat|fish|seafood|poultry|eggs|carne|pescado/.test(t)) return 'protein';
  if (/beverage|drink|water|bebida/.test(t)) return 'drink';
  if (/fruit|fruta/.test(t)) return 'fruit';
  if (/vegetable|verdura|legume/.test(t)) return 'vegetable';
  if (/oil|fat|nuts|aceite/.test(t)) return 'fat';
  if (/cereal|bread|pasta|rice|pan|arroz/.test(t)) return 'carb';
  // Sin etiquetas útiles, se clasifica por el macro dominante.
  if (n.protein >= 15) return 'protein';
  if (n.fat >= 30) return 'fat';
  if (n.carbs >= 40) return 'carb';
  return 'other';
}

function guessProteinSource(tags: string[]): Food['proteinSource'] {
  const t = tags.join(' ');
  if (/egg|huevo/.test(t)) return 'egg';
  if (/chicken|turkey|poultry|pollo|pavo/.test(t)) return 'poultry';
  if (/beef|pork|lamb|carne|cerdo|ternera/.test(t)) return 'redMeat';
  if (/fish|tuna|salmon|seafood|atun|pescado/.test(t)) return 'fish';
  if (/dairy|yogurt|cheese|milk|lacteo|queso/.test(t)) return 'dairy';
  if (/soy|soja|tofu/.test(t)) return 'soy';
  if (/legume|lentil|chickpea|bean|legumbre/.test(t)) return 'legume';
  if (/protein-powder|whey/.test(t)) return 'supplement';
  return 'none';
}
