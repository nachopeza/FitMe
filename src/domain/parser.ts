import type { Confidence, Food, MealSlot } from './types';

/**
 * Parser de lenguaje natural en español para registro de comidas.
 *
 * Funciona íntegramente en el dispositivo, sin ninguna API: la transcripción la
 * da el navegador (Web Speech API) y la interpretación la hace este módulo
 * contra la base de alimentos. Así el registro por voz no depende de nada de pago.
 *
 * Nunca finge precisión: cada cantidad sale etiquetada con su confianza y el
 * usuario confirma antes de guardar.
 */

// ───────────────────────────── Normalización ─────────────────────────────

export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9ñ.,\s]/g, ' ')
    // La coma entre dígitos es un decimal ("0,2 kg"), no un separador de lista.
    .replace(/(\d),(\d)/g, '$1.$2')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Reduce plurales y variantes para que "huevos" case con "huevo". */
export function stem(token: string): string {
  let t = token;
  if (t.length > 5 && t.endsWith('es')) t = t.slice(0, -2);
  else if (t.length > 3 && t.endsWith('s')) t = t.slice(0, -1);
  return t;
}

const STOPWORDS = new Set([
  'de', 'del', 'la', 'el', 'los', 'las', 'lo', 'y', 'e', 'o', 'u', 'un', 'una', 'unos', 'unas',
  'con', 'sin', 'al', 'a', 'en', 'para', 'por', 'mi', 'me', 'he', 'ha', 'mas', 'muy', 'bien',
  'que', 'como', 'tambien', 'ademas', 'algo', 'poco', 'poca', 'bastante', 'tipo',
]);

/** Muletillas de dictado que no aportan nada al contenido de la comida. */
const LEAD_PHRASES = [
  'he comido', 'he cenado', 'he desayunado', 'he merendado', 'he tomado', 'me he tomado',
  'me he comido', 'hoy he comido', 'para desayunar', 'para comer', 'para cenar',
  'para merendar', 'de desayuno', 'de comida', 'de cena', 'de merienda', 'he almorzado',
  'apunta', 'anota', 'registra', 'anadir', 'agrega',
];

function stripLead(text: string): string {
  let t = text;
  let changed = true;
  while (changed) {
    changed = false;
    for (const p of LEAD_PHRASES) {
      if (t.startsWith(p + ' ')) {
        t = t.slice(p.length + 1);
        changed = true;
      }
    }
  }
  return t.trim();
}

// ───────────────────────────── Números en palabras ─────────────────────────────

const WORD_NUMBERS: Record<string, number> = {
  cero: 0, un: 1, uno: 1, una: 1, dos: 2, tres: 3, cuatro: 4, cinco: 5, seis: 6, siete: 7,
  ocho: 8, nueve: 9, diez: 10, once: 11, doce: 12, trece: 13, catorce: 14, quince: 15,
  dieciseis: 16, diecisiete: 17, dieciocho: 18, diecinueve: 19, veinte: 20,
  veinticinco: 25, treinta: 30, cuarenta: 40, cincuenta: 50, sesenta: 60, setenta: 70,
  ochenta: 80, noventa: 90, cien: 100, ciento: 100, doscientos: 200, trescientos: 300,
  cuatrocientos: 400, quinientos: 500, medio: 0.5, media: 0.5,
};

const MULTI_WORD_NUMBERS: [string, number][] = [
  ['ciento cincuenta', 150], ['ciento veinte', 120], ['ciento ochenta', 180],
  ['ciento treinta', 130], ['ciento cuarenta', 140], ['ciento sesenta', 160],
  ['ciento setenta', 170], ['ciento diez', 110], ['doscientos cincuenta', 250],
  ['doscientos veinte', 220], ['trescientos cincuenta', 350], ['un par', 2], ['par de', 2],
  ['media docena', 6], ['una docena', 12], ['un cuarto', 0.25], ['tres cuartos', 0.75],
];

/** Convierte números escritos con palabras a dígitos antes de parsear. */
export function digitizeNumbers(text: string): string {
  let t = text;
  for (const [phrase, value] of MULTI_WORD_NUMBERS) {
    t = t.replace(new RegExp(`\\b${phrase}\\b`, 'g'), String(value));
  }
  return t.replace(/\b([a-zñ]+)\b/g, (m) => {
    const v = WORD_NUMBERS[m];
    return v != null ? String(v) : m;
  });
}

// ───────────────────────────── Unidades ─────────────────────────────

type UnitKind = 'mass' | 'volume' | 'portion' | 'count';

interface UnitMatch {
  kind: UnitKind;
  /** Factor a gramos/ml para masa y volumen. */
  factor?: number;
  /** Etiqueta de ración a buscar en el alimento. */
  portionKey?: string;
}

const UNITS: [RegExp, UnitMatch][] = [
  [/\b(kilos?|kg|kilogramos?)\b/, { kind: 'mass', factor: 1000 }],
  [/\b(gramos?|grs?|gr|g)\b/, { kind: 'mass', factor: 1 }],
  [/\b(litros?|l)\b/, { kind: 'volume', factor: 1000 }],
  [/\b(mililitros?|ml|cl)\b/, { kind: 'volume', factor: 1 }],
  [/\b(cucharadita?s?)\b/, { kind: 'portion', portionKey: 'cucharadita' }],
  [/\b(cucharadas?|cuchara)\b/, { kind: 'portion', portionKey: 'cucharada' }],
  [/\b(punados?|punadito)\b/, { kind: 'portion', portionKey: 'puñado' }],
  [/\b(platos?)\b/, { kind: 'portion', portionKey: 'plato' }],
  [/\b(lonchas?)\b/, { kind: 'portion', portionKey: 'loncha' }],
  [/\b(latas?|botes?)\b/, { kind: 'portion', portionKey: 'lata' }],
  [/\b(vasos?)\b/, { kind: 'portion', portionKey: 'vaso' }],
  [/\b(tazas?)\b/, { kind: 'portion', portionKey: 'taza' }],
  [/\b(rebanadas?|tostadas?)\b/, { kind: 'portion', portionKey: 'rebanada' }],
  [/\b(rodajas?)\b/, { kind: 'portion', portionKey: 'rodaja' }],
  [/\b(filetes?)\b/, { kind: 'portion', portionKey: 'filete' }],
  [/\b(onzas?)\b/, { kind: 'portion', portionKey: 'onza' }],
  [/\b(cacitos?|scoops?)\b/, { kind: 'portion', portionKey: 'cacito' }],
  [/\b(tarrinas?)\b/, { kind: 'portion', portionKey: 'tarrina' }],
  [/\b(bolas?)\b/, { kind: 'portion', portionKey: 'bola' }],
  [/\b(unidades?|uds?|piezas?)\b/, { kind: 'portion', portionKey: 'unidad' }],
  [/\b(chorros?|chorrito)\b/, { kind: 'portion', portionKey: 'chorro' }],
  [/\b(trozos?|pedazos?)\b/, { kind: 'portion', portionKey: 'trozo' }],
  [/\b(raciones?|racion)\b/, { kind: 'portion', portionKey: 'ración' }],
];

/**
 * Todas las palabras que designan unidades. Deben salir del fragmento antes de
 * buscar el alimento: sin esto, la "g" de "100 g de arroz" hacía prefijo con
 * "garbanzos" y se colaba el alimento equivocado.
 */
const UNIT_WORDS = new Set(
  (
    'kilo kilos kg kilogramo kilogramos gramo gramos gr grs g litro litros l mililitro ' +
    'mililitros ml cl cucharada cucharadas cuchara cucharadita cucharaditas punado punados ' +
    'punadito plato platos loncha lonchas lata latas bote botes vaso vasos taza tazas ' +
    'rebanada rebanadas tostada tostadas rodaja rodajas filete filetes onza onzas cacito ' +
    'cacitos scoop scoops tarrina tarrinas bola bolas unidad unidades ud uds pieza piezas ' +
    'chorro chorros chorrito trozo trozos pedazo pedazos racion raciones docena'
  ).split(' '),
);

/** Marcadores de imprecisión: bajan la confianza sin falsear el dato. */
const HEDGES = /\b(unos|unas|como|aproximadamente|mas o menos|masomenos|casi|sobre|algo de|un poco de|creo)\b/;

// ───────────────────────────── Índice de búsqueda ─────────────────────────────

interface IndexEntry {
  foodId: string;
  tokens: string[];
  raw: boolean;
  /** Longitud del término: los términos más específicos ganan. */
  weight: number;
}

export interface FoodIndex {
  entries: IndexEntry[];
  byId: Map<string, Food>;
}

/** Quita el estado entre paréntesis del nombre: "Arroz blanco (cocido)" → "arroz blanco". */
function cleanName(name: string): string {
  return normalize(name.replace(/\([^)]*\)/g, ''));
}

export function buildIndex(foods: Food[]): FoodIndex {
  const entries: IndexEntry[] = [];
  const byId = new Map<string, Food>();
  for (const f of foods) {
    byId.set(f.id, f);
    const terms = new Set<string>([cleanName(f.name), ...f.aliases.map(normalize)]);
    if (f.brand) terms.add(normalize(`${f.brand} ${f.name}`));
    for (const term of terms) {
      const tokens = term.split(' ').map(stem).filter((t) => t && !STOPWORDS.has(t));
      if (!tokens.length) continue;
      entries.push({
        foodId: f.id,
        tokens,
        raw: f.state === 'raw',
        weight: tokens.reduce((a, t) => a + t.length, 0),
      });
    }
  }
  return { entries, byId };
}

// ───────────────────────────── Segmentación ─────────────────────────────

/**
 * Parte la frase en trozos, uno por alimento. "con" separa alimentos en
 * español coloquial ("arroz con pollo", "café con leche"), así que también corta.
 */
export function segment(text: string): string[] {
  return text
    .split(/,| y | e | mas | ademas | tambien | con | junto a | acompanado de /)
    .map((s) => s.trim())
    .filter((s) => s.length > 1);
}

// ───────────────────────────── Resultado ─────────────────────────────

export interface ParsedItem {
  foodId: string;
  foodName: string;
  /** Cantidad en la unidad indicada. */
  quantity: number;
  unit: 'g' | 'ml' | 'portion';
  portionLabel?: string;
  grams: number;
  confidence: Confidence;
  /** Fragmento original del que salió, para poder auditarlo. */
  source: string;
  /** Alternativas de cantidad que se ofrecen al confirmar. */
  options?: number[];
}

export interface ParseResult {
  items: ParsedItem[];
  /** Trozos que no se han podido identificar: se muestran para añadirlos a mano. */
  unmatched: string[];
  slot?: MealSlot;
  transcript: string;
}

/**
 * Detecta a qué comida se refiere la frase, si lo dice explícitamente.
 *
 * Se ejecuta SOBRE EL TEXTO YA LIMPIO de muletillas. Si no, "he comido" —que en
 * español es la forma normal de decir "he tomado"— se interpretaba como "la
 * comida" y todo lo dictado por la noche acababa clasificado como almuerzo.
 */
function detectSlot(text: string): MealSlot | undefined {
  if (/\bdesayun/.test(text)) return 'breakfast';
  if (/\bmerien|merend/.test(text)) return 'snack';
  if (/\bcen[ao]\b|\bcenad/.test(text)) return 'dinner';
  if (/\bcomida\b|\balmuerzo\b|almorz/.test(text)) return 'lunch';
  return undefined;
}

/**
 * Franja deducida de la propia muletilla: "he cenado", "para desayunar",
 * "de merienda". Aquí sí es una señal fiable, porque el verbo está conjugado
 * con la comida concreta.
 */
function detectSlotFromLead(text: string): MealSlot | undefined {
  if (/\b(he desayunado|para desayunar|de desayuno)\b/.test(text)) return 'breakfast';
  if (/\b(he merendado|para merendar|de merienda)\b/.test(text)) return 'snack';
  if (/\b(he cenado|para cenar|de cena)\b/.test(text)) return 'dinner';
  if (/\b(he almorzado|para comer|de comida)\b/.test(text)) return 'lunch';
  return undefined;
}

/** Busca la ración del alimento cuya etiqueta encaja con la unidad dicha. */
function findPortion(food: Food, key: string) {
  const k = normalize(key);
  return (
    food.portions.find((p) => normalize(p.label) === k) ??
    food.portions.find((p) => normalize(p.label).startsWith(k)) ??
    food.portions.find((p) => normalize(p.label).includes(k))
  );
}

function defaultPortion(food: Food) {
  return food.portions.find((p) => p.isDefault) ?? food.portions[0];
}

/** Puntúa una entrada del índice contra los tokens del fragmento. */
function scoreEntry(entry: IndexEntry, segTokens: string[], wantsRaw: boolean): number {
  let matched = 0;
  let score = 0;
  for (const t of entry.tokens) {
    // El prefijo solo vale si ambos lados tienen cuerpo suficiente: si no,
    // una palabra de una letra casa con cualquier alimento que empiece igual.
    const hit = segTokens.some(
      (s) => s === t || (t.length >= 4 && s.length >= 4 && (s.startsWith(t) || t.startsWith(s))),
    );
    if (hit) {
      matched++;
      score += t.length * 2;
    }
  }
  // Se exige que TODOS los tokens del término aparezcan: evita que "pollo"
  // dispare con "carne picada de pollo" a medias y al revés.
  if (matched < entry.tokens.length) return 0;
  // Bonus por especificidad: el término más largo que encaja gana.
  score += entry.weight;
  // Penalización por tokens del fragmento que sobran (probable confusión).
  score -= Math.max(0, segTokens.length - entry.tokens.length) * 0.5;
  // Salvo que se diga "crudo", lo que se come está cocinado o listo para comer.
  if (entry.raw && !wantsRaw) score -= 12;
  if (!entry.raw && wantsRaw) score -= 6;
  return score;
}

// ───────────────────────────── Parser principal ─────────────────────────────

export function parsePhrase(input: string, index: FoodIndex): ParseResult {
  const normalized = normalize(input);
  const stripped = stripLead(normalized);
  // La franja se busca en la frase sin muletillas: "he comido" no es "la comida".
  const slot = detectSlot(stripped) ?? detectSlotFromLead(normalized);
  const body = digitizeNumbers(stripped);
  const segments = segment(body);

  const items: ParsedItem[] = [];
  const unmatched: string[] = [];

  for (const seg of segments) {
    const hedged = HEDGES.test(seg);
    const wantsRaw = /\bcrud[oa]s?\b|\ben seco\b|\bsin cocinar\b/.test(seg);

    // 1. Cantidad numérica, si hay.
    const numMatch = seg.match(/(\d+(?:[.,]\d+)?)/);
    const amount = numMatch ? parseFloat(numMatch[1].replace(',', '.')) : null;

    // 2. Unidad, si hay.
    let unitMatch: UnitMatch | null = null;
    for (const [re, u] of UNITS) {
      if (re.test(seg)) {
        unitMatch = u;
        break;
      }
    }

    // 3. Alimento: se buscan los tokens que no son número ni unidad.
    const segTokens = seg
      .split(' ')
      .map((t) => t.replace(/[.,]/g, ''))
      .filter((t) => t && !/^\d+(\.\d+)?$/.test(t))
      .filter((t) => !UNIT_WORDS.has(t))
      .map(stem)
      .filter((t) => !STOPWORDS.has(t) && !UNIT_WORDS.has(t));

    if (!segTokens.length) continue;

    let best: { entry: IndexEntry; score: number } | null = null;
    for (const entry of index.entries) {
      const score = scoreEntry(entry, segTokens, wantsRaw);
      if (score > 0 && (!best || score > best.score)) best = { entry, score };
    }

    if (!best) {
      unmatched.push(seg);
      continue;
    }

    const food = index.byId.get(best.entry.foodId);
    if (!food) {
      unmatched.push(seg);
      continue;
    }

    items.push(buildItem(food, amount, unitMatch, hedged, seg));
  }

  return { items: mergeDuplicates(items), unmatched, slot, transcript: input.trim() };
}

function buildItem(
  food: Food,
  amount: number | null,
  unitMatch: UnitMatch | null,
  hedged: boolean,
  source: string,
): ParsedItem {
  const base = { foodId: food.id, foodName: food.name, source };

  // Caso A: masa o volumen explícitos → el dato más fiable que existe.
  if (unitMatch && (unitMatch.kind === 'mass' || unitMatch.kind === 'volume') && amount != null) {
    const grams = amount * (unitMatch.factor ?? 1);
    return {
      ...base,
      quantity: grams,
      unit: food.unit,
      grams,
      confidence: hedged ? 'estimated' : 'exact',
      options: [grams, Math.round(grams * 0.75), Math.round(grams * 1.25)],
    };
  }

  // Caso B: ración con nombre ("un plato de", "dos lonchas").
  if (unitMatch?.kind === 'portion' && unitMatch.portionKey) {
    const portion = findPortion(food, unitMatch.portionKey) ?? defaultPortion(food);
    const qty = amount ?? 1;
    const grams = qty * (portion?.grams ?? 100);
    // "un plato de arroz" no es un dato exacto: se etiqueta como estimación.
    const isVague = /plato|punado|chorro|trozo|racion/.test(unitMatch.portionKey);
    return {
      ...base,
      quantity: qty,
      unit: 'portion',
      portionLabel: portion?.label,
      grams,
      confidence: isVague || hedged ? 'estimated' : 'exact',
      options: portionOptions(grams),
    };
  }

  // Caso C: número suelto ("dos huevos", "tres mandarinas").
  const portion = defaultPortion(food);
  if (amount != null) {
    const grams = amount * (portion?.grams ?? 100);
    // Contar unidades discretas sí es exacto; contar "2 arroces" no lo es.
    const countable = /unidad|loncha|filete|clara|bola|onza|cacito|rebanada|tarrina|lata/.test(
      normalize(portion?.label ?? ''),
    );
    return {
      ...base,
      quantity: amount,
      unit: 'portion',
      portionLabel: portion?.label,
      grams,
      confidence: countable && !hedged ? 'exact' : 'estimated',
      options: portionOptions(grams),
    };
  }

  // Caso D: sin cantidad alguna → ración por defecto, confianza baja y explícita.
  const grams = portion?.grams ?? 100;
  return {
    ...base,
    quantity: 1,
    unit: 'portion',
    portionLabel: portion?.label,
    grams,
    confidence: 'rough',
    options: portionOptions(grams),
  };
}

/** Alternativas que se ofrecen al confirmar, además de "no sé". */
function portionOptions(grams: number): number[] {
  const base = Math.max(10, Math.round(grams / 10) * 10);
  const set = new Set([
    Math.round(base * 0.5),
    Math.round(base * 0.75),
    base,
    Math.round(base * 1.25),
    Math.round(base * 1.5),
  ]);
  return [...set].filter((v) => v > 0).sort((a, b) => a - b);
}

/** Si el mismo alimento aparece dos veces, se suman las cantidades. */
function mergeDuplicates(items: ParsedItem[]): ParsedItem[] {
  const out: ParsedItem[] = [];
  for (const item of items) {
    const prev = out.find((o) => o.foodId === item.foodId && o.unit === item.unit && o.portionLabel === item.portionLabel);
    if (prev) {
      prev.quantity += item.quantity;
      prev.grams += item.grams;
      prev.confidence = prev.confidence === 'exact' && item.confidence === 'exact' ? 'exact' : 'estimated';
      prev.source = `${prev.source} + ${item.source}`;
    } else {
      out.push(item);
    }
  }
  return out;
}

// ───────────────────────────── Búsqueda libre ─────────────────────────────

/** Buscador del registro manual: tolerante a acentos, plurales y orden. */
export function searchFoods(query: string, foods: Food[], limit = 30): Food[] {
  const q = normalize(query);
  if (!q) return foods.slice(0, limit);
  const qTokens = q.split(' ').map(stem).filter(Boolean);
  const scored: { food: Food; score: number }[] = [];
  for (const food of foods) {
    const haystack = [cleanName(food.name), ...food.aliases.map(normalize), normalize(food.brand ?? '')].join(' ');
    const hTokens = haystack.split(' ').map(stem);
    let score = 0;
    let all = true;
    for (const qt of qTokens) {
      const hit = hTokens.some((h) => h === qt || h.startsWith(qt) || (qt.length >= 4 && qt.startsWith(h) && h.length >= 4));
      if (hit) score += qt.length + 2;
      else all = false;
    }
    if (!all) score -= 100;
    if (cleanName(food.name).startsWith(q)) score += 15;
    if (food.state === 'raw') score -= 2;
    if (score > 0) scored.push({ food, score });
  }
  return scored.sort((a, b) => b.score - a.score).slice(0, limit).map((s) => s.food);
}
