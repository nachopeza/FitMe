import type { Nutrients } from '../../domain/types';

/**
 * Extractor de tablas de información nutricional en español.
 *
 * Funciona sobre TEXTO, venga de donde venga: reconocimiento óptico del
 * navegador, análisis con IA, o pegado a mano desde otra app. Así la parte
 * difícil (interpretar la tabla) está aislada, es determinista y se puede probar.
 *
 * Maneja las particularidades de las etiquetas europeas:
 *   - energía en kJ y kcal a la vez (se toma kcal)
 *   - coma decimal
 *   - "de las cuales saturadas" y "de los cuales azúcares" como subcampos
 *   - columnas "por 100 g" y "por ración" (se toma la de 100 g)
 *   - "<0,5 g" y "trazas"
 */

export interface LabelReading {
  per100g: Partial<Nutrients>;
  /** Tamaño de ración declarado, si aparece. */
  servingGrams?: number;
  /** Campos que no se han encontrado: se piden a mano en vez de suponerlos. */
  missing: string[];
  /** Texto normalizado usado, para poder auditar la lectura. */
  usedText: string;
}

function normalizeText(raw: string): string {
  return raw
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[|]/g, ' ')
    .replace(/[\t\r]+/g, ' ')
    .replace(/[ ]{2,}/g, ' ');
}

/** Convierte "12,5", "<0,5", "trazas" o "1.234" en número. */
function toNumber(raw: string | undefined): number | null {
  if (!raw) return null;
  const t = raw.trim();
  if (/^(trazas|traza)$/.test(t)) return 0;
  // Se captura el número completo de una vez. Partirlo en alternativas hacía
  // que "2000" se leyera como "200" al probar primero el patrón de millares.
  const m = t.match(/^<?\s*(\d+(?:[.,]\d+)*)/);
  if (!m) return null;
  let s = m[1];
  // Solo es separador de millares si TODOS los grupos tras el primero tienen
  // exactamente tres cifras: "1.234" son mil doscientos treinta y cuatro,
  // pero "1.5" es uno y medio.
  if (/^\d{1,3}(?:[.,]\d{3})+$/.test(s)) s = s.replace(/[.,]/g, '');
  else s = s.replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : null;
}

/**
 * Busca un valor numérico en la línea que contiene una etiqueta.
 * Toma el PRIMER número de la línea tras la etiqueta: en las tablas de dos
 * columnas, la primera es la de 100 g, que es la que queremos.
 */
function findValue(lines: string[], patterns: RegExp[], opts: { skipFirst?: number } = {}): number | null {
  for (const line of lines) {
    for (const p of patterns) {
      const m = line.match(p);
      if (!m) continue;
      const rest = line.slice((m.index ?? 0) + m[0].length);
      const nums = rest.match(/<?\s*\d+(?:[.,]\d+)?/g);
      if (!nums?.length) continue;
      const idx = opts.skipFirst ?? 0;
      const v = toNumber(nums[idx] ?? nums[0]);
      if (v != null) return v;
    }
  }
  return null;
}

export function parseNutritionLabel(raw: string): LabelReading {
  const text = normalizeText(raw);
  const lines = text
    .split(/\n+/)
    .map((l) => l.trim())
    .filter(Boolean);
  // Algunas lecturas llegan en una sola línea: se añade el texto completo como
  // línea adicional para que los patrones también funcionen ahí.
  const hay = [...lines, text];

  const per100g: Partial<Nutrients> = {};
  const missing: string[] = [];

  // Energía: si la línea trae kJ y kcal, hay que quedarse con kcal.
  let kcal: number | null = null;
  for (const line of hay) {
    if (!/energia|valor energetico|kcal|kj/.test(line)) continue;
    const kcalMatch = line.match(/(\d+(?:[.,]\d+)?)\s*kcal/);
    if (kcalMatch) {
      kcal = toNumber(kcalMatch[1]);
      break;
    }
  }
  if (kcal == null) {
    // Solo hay kJ: se convierte (1 kcal = 4,184 kJ).
    for (const line of hay) {
      const kj = line.match(/(\d+(?:[.,]\d+)?)\s*kj/);
      if (kj) {
        const v = toNumber(kj[1]);
        if (v != null) {
          kcal = Math.round(v / 4.184);
          break;
        }
      }
    }
  }
  if (kcal != null) per100g.kcal = kcal;
  else missing.push('energía');

  const fat = findValue(hay, [/grasas?(?! de)/, /materia grasa/, /\blipidos\b/]);
  if (fat != null) per100g.fat = fat;
  else missing.push('grasas');

  const satFat = findValue(hay, [/saturad[ao]s?/, /de las cuales saturadas/]);
  if (satFat != null) per100g.satFat = satFat;

  const carbs = findValue(hay, [/hidratos de carbono/, /carbohidratos?/, /\bhc\b/]);
  if (carbs != null) per100g.carbs = carbs;
  else missing.push('hidratos de carbono');

  const sugars = findValue(hay, [/azucares?/, /de los cuales azucares/]);
  if (sugars != null) per100g.sugars = sugars;

  const fiber = findValue(hay, [/fibra(?: alimentaria)?/]);
  if (fiber != null) per100g.fiber = fiber;
  else missing.push('fibra');

  const protein = findValue(hay, [/proteinas?/]);
  if (protein != null) per100g.protein = protein;
  else missing.push('proteínas');

  // Sal declarada en gramos → sodio en miligramos (1 g de sal ≈ 400 mg de sodio).
  const salt = findValue(hay, [/\bsal\b/]);
  const sodium = findValue(hay, [/\bsodio\b/]);
  if (sodium != null) per100g.sodium = sodium >= 20 ? sodium : sodium * 1000;
  else if (salt != null) per100g.sodium = Math.round(salt * 400);

  // Tamaño de ración.
  let servingGrams: number | undefined;
  for (const line of hay) {
    const m = line.match(/(?:racion|porcion|por unidad)[^\d]{0,20}(\d+(?:[.,]\d+)?)\s*(g|ml)/);
    if (m) {
      const v = toNumber(m[1]);
      if (v != null) {
        servingGrams = v;
        break;
      }
    }
  }

  return { per100g, servingGrams, missing, usedText: text };
}

/**
 * Comprueba que lo leído es coherente. Una etiqueta mal leída suele delatarse
 * porque la energía no cuadra con los macros o porque un valor supera 100 g.
 */
export function validateLabel(r: Partial<Nutrients>): string[] {
  const problems: string[] = [];
  const sum = (r.protein ?? 0) + (r.carbs ?? 0) + (r.fat ?? 0) + (r.fiber ?? 0);
  if (sum > 100) problems.push('Los macros suman más de 100 g por 100 g de producto: revisa los valores.');
  if ((r.satFat ?? 0) > (r.fat ?? 0) + 0.1) problems.push('Las saturadas no pueden superar la grasa total.');
  if ((r.sugars ?? 0) > (r.carbs ?? 0) + 0.1) problems.push('Los azúcares no pueden superar los hidratos de carbono.');
  if (r.kcal != null && sum > 0) {
    const expected = (r.protein ?? 0) * 4 + (r.carbs ?? 0) * 4 + (r.fat ?? 0) * 9 + (r.fiber ?? 0) * 2;
    const dev = Math.abs(expected - r.kcal) / Math.max(r.kcal, 1);
    if (dev > 0.25) {
      problems.push(
        `La energía leída (${Math.round(r.kcal)} kcal) no cuadra con los macros (${Math.round(expected)} kcal). Comprueba que no se haya colado la columna de la ración.`,
      );
    }
  }
  return problems;
}
