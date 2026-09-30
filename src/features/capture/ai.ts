import Anthropic from '@anthropic-ai/sdk';
import { zodOutputFormat } from '@anthropic-ai/sdk/helpers/zod';
import { z } from 'zod';
import type { Food } from '../../domain/types';
import type { ImagePayload } from './image';

/**
 * Análisis de imágenes con IA: opcional y desactivado por defecto.
 *
 * Decisión de diseño: ninguna función básica de la app depende de esto. El
 * registro por voz, el escáner de códigos de barras y la lectura de etiquetas
 * funcionan sin IA. Esto solo añade el reconocimiento automático de platos.
 *
 * La clave es del usuario y se guarda únicamente en este dispositivo (IndexedDB).
 * Las peticiones van del navegador directamente a la API de Anthropic, sin
 * pasar por ningún servidor intermedio: no hay backend que pueda verlas.
 *
 * Advertencia honesta: una clave en el navegador es visible para cualquier
 * script de la página y para quien tenga acceso al dispositivo. Es aceptable
 * para una app personal e instalable como esta, y así se le dice al usuario en
 * la pantalla de ajustes.
 */

export const DEFAULT_AI_MODEL = 'claude-opus-5-5';

export class AiNotConfiguredError extends Error {
  constructor() {
    super('El análisis con IA no está configurado.');
    this.name = 'AiNotConfiguredError';
  }
}

function makeClient(apiKey: string): Anthropic {
  return new Anthropic({
    apiKey,
    // Necesario para llamar a la API desde el navegador.
    dangerouslyAllowBrowser: true,
    maxRetries: 2,
  });
}

// ───────────────────────────── Esquemas de salida ─────────────────────────────

/**
 * Lo que se le pide al modelo. Fíjate en `confidence` y en `grams_low`/
 * `grams_high`: se le pide explícitamente que exprese su incertidumbre en vez
 * de dar una cifra única que parezca exacta.
 */
const PlateItemSchema = z.object({
  name: z.string().describe('Nombre del alimento en español, en singular y sin marca'),
  match_hint: z
    .string()
    .describe('Palabra clave simple para buscarlo en una base de alimentos, p. ej. "arroz cocido"'),
  state: z.enum(['crudo', 'cocinado', 'producto', 'tal cual']).describe('Estado en que se ve en la foto'),
  grams: z.number().describe('Estimación central de gramos de porción comestible'),
  grams_low: z.number().describe('Extremo bajo razonable de la estimación'),
  grams_high: z.number().describe('Extremo alto razonable de la estimación'),
  countable_units: z
    .number()
    .nullable()
    .describe('Número de unidades si es contable (huevos, fajitas, lonchas); null si no lo es'),
  confidence: z.enum(['alta', 'media', 'baja']).describe('Confianza en la identificación y la cantidad'),
});

const PlateAnalysisSchema = z.object({
  items: z.array(PlateItemSchema),
  notes: z
    .array(z.string())
    .describe('Avisos útiles: oclusiones, salsas no visibles, dudas sobre el método de cocinado'),
  overall_confidence: z.enum(['alta', 'media', 'baja']),
});

export type PlateAnalysis = z.infer<typeof PlateAnalysisSchema>;
export type PlateItem = z.infer<typeof PlateItemSchema>;

const LabelSchema = z.object({
  product_name: z.string().nullable(),
  brand: z.string().nullable(),
  /** Texto de la tabla, tal cual se lee. Lo interpreta el parser local. */
  raw_table_text: z.string().describe('Transcripción literal de la tabla nutricional, línea por línea'),
  serving_grams: z.number().nullable(),
  unreadable: z.boolean().describe('true si la tabla no se puede leer con fiabilidad'),
});

export type LabelAnalysis = z.infer<typeof LabelSchema>;

// ───────────────────────────── Prompts ─────────────────────────────

const PLATE_SYSTEM = `Eres un nutricionista deportivo que estima raciones a partir de fotografías de comida.

Reglas que no puedes romper:
1. NO finjas precisión. Una foto no permite conocer los gramos exactos. Da siempre un rango (grams_low, grams_high) que refleje tu incertidumbre real.
2. Distingue crudo de cocinado. Si ves arroz en el plato, está COCINADO: 100 g de arroz cocido son unas 130 kcal, no 355. Confundirlo es el error más grave posible.
3. Para alimentos contables (huevos, fajitas, lonchas, filetes), cuenta unidades en countable_units.
4. No inventes alimentos que no puedas ver. Si algo está tapado o no lo distingues, dilo en notes en lugar de adivinar.
5. El aceite y las salsas de cocinado casi nunca se ven pero suman bastante energía: si el plato parece cocinado con grasa, añádelo como item con confianza baja y explícalo en notes.
6. Responde en español.`;

const LABEL_SYSTEM = `Transcribes tablas de información nutricional de etiquetas de alimentos.

Reglas:
1. Transcribe la tabla LITERALMENTE en raw_table_text, una línea por fila, conservando las unidades (kJ, kcal, g, mg) y la coma decimal española.
2. Si la etiqueta tiene dos columnas (por 100 g y por ración), incluye ambas en la transcripción y deja claro en la primera línea cuál es cuál.
3. No calcules ni corrijas nada: solo transcribe lo que ves.
4. Si la imagen está borrosa, cortada o no contiene una tabla nutricional, pon unreadable en true y no inventes números.`;

// ───────────────────────────── Llamadas ─────────────────────────────

export interface AiConfig {
  apiKey?: string;
  model?: string;
}

/** Analiza la foto de un plato y devuelve ingredientes con rangos de cantidad. */
export async function analysePlate(
  image: ImagePayload,
  config: AiConfig,
  /** Alimentos habituales del usuario: ayudan a que el modelo acierte el nombre. */
  pantry: Food[] = [],
): Promise<PlateAnalysis> {
  if (!config.apiKey) throw new AiNotConfiguredError();
  const client = makeClient(config.apiKey);

  const pantryHint = pantry.length
    ? `\n\nAlimentos que esta persona come habitualmente (úsalos como primera opción en match_hint si encajan):\n${pantry
        .slice(0, 60)
        .map((f) => `- ${f.name}`)
        .join('\n')}`
    : '';

  const response = await client.messages.parse({
    model: config.model ?? DEFAULT_AI_MODEL,
    max_tokens: 4000,
    system: PLATE_SYSTEM + pantryHint,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
          {
            type: 'text',
            text: 'Identifica los alimentos de esta foto y estima la cantidad de cada uno, con su rango de incertidumbre.',
          },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(PlateAnalysisSchema) },
  });

  if (response.stop_reason === 'refusal') {
    throw new Error('El modelo no ha podido analizar esta imagen.');
  }
  if (!response.parsed_output) {
    throw new Error('La respuesta del modelo no se ha podido interpretar. Inténtalo otra vez.');
  }
  return response.parsed_output;
}

/** Transcribe la tabla nutricional de una etiqueta. El parseo es local. */
export async function readLabel(image: ImagePayload, config: AiConfig): Promise<LabelAnalysis> {
  if (!config.apiKey) throw new AiNotConfiguredError();
  const client = makeClient(config.apiKey);

  const response = await client.messages.parse({
    model: config.model ?? DEFAULT_AI_MODEL,
    max_tokens: 2000,
    system: LABEL_SYSTEM,
    messages: [
      {
        role: 'user',
        content: [
          { type: 'image', source: { type: 'base64', media_type: image.mediaType, data: image.data } },
          { type: 'text', text: 'Transcribe la información nutricional de esta etiqueta.' },
        ],
      },
    ],
    output_config: { format: zodOutputFormat(LabelSchema) },
  });

  if (response.stop_reason === 'refusal') throw new Error('El modelo no ha podido leer esta etiqueta.');
  if (!response.parsed_output) throw new Error('No se ha podido interpretar la respuesta del modelo.');
  return response.parsed_output;
}

/** Comprueba que la clave funciona, con la petición más pequeña posible. */
export async function testApiKey(apiKey: string, model = DEFAULT_AI_MODEL): Promise<void> {
  const client = makeClient(apiKey);
  await client.messages.create({
    model,
    max_tokens: 16,
    messages: [{ role: 'user', content: 'Responde solo con: ok' }],
  });
}

/** Mensaje legible para el usuario a partir de un error de la API. */
export function describeAiError(err: unknown): string {
  if (err instanceof AiNotConfiguredError) {
    return 'Todavía no has configurado el análisis con IA. Puedes hacerlo en Perfil → Análisis de fotos con IA.';
  }
  if (err instanceof Anthropic.AuthenticationError) return 'La clave de la API no es válida.';
  if (err instanceof Anthropic.RateLimitError) return 'Has alcanzado el límite de peticiones. Prueba en un minuto.';
  if (err instanceof Anthropic.BadRequestError) return `La petición no es válida: ${err.message}`;
  if (err instanceof Anthropic.APIConnectionError) return 'No hay conexión con la API. Revisa tu red.';
  if (err instanceof Anthropic.APIError) return `Error de la API (${err.status}): ${err.message}`;
  return err instanceof Error ? err.message : 'Error desconocido al analizar la imagen.';
}
