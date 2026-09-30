import type { Food } from '../../domain/types';
import type { ImagePayload } from './image';
import type { AiConfig, LabelAnalysis, PlateAnalysis } from './ai';

/**
 * Puerta de entrada al análisis con IA, con carga diferida.
 *
 * El SDK de Anthropic y zod pesan bastante y el análisis con IA es opcional, así
 * que el módulo que los usa se descarga solo cuando el usuario lo utiliza de
 * verdad. Quien no active la IA no paga ni un byte por ella.
 */

/** Error ya traducido a algo que se le puede mostrar al usuario. */
export class AiError extends Error {}

export const DEFAULT_AI_MODEL = 'claude-opus-5-5';

async function load() {
  return import('./ai');
}

export async function analysePlate(
  image: ImagePayload,
  config: AiConfig,
  pantry: Food[] = [],
): Promise<PlateAnalysis> {
  const mod = await load();
  try {
    return await mod.analysePlate(image, config, pantry);
  } catch (err) {
    throw new AiError(mod.describeAiError(err));
  }
}

export async function readLabel(image: ImagePayload, config: AiConfig): Promise<LabelAnalysis> {
  const mod = await load();
  try {
    return await mod.readLabel(image, config);
  } catch (err) {
    throw new AiError(mod.describeAiError(err));
  }
}

export async function testApiKey(apiKey: string, model = DEFAULT_AI_MODEL): Promise<void> {
  const mod = await load();
  try {
    await mod.testApiKey(apiKey, model);
  } catch (err) {
    throw new AiError(mod.describeAiError(err));
  }
}

/** Mensaje legible de cualquier error, sin cargar el SDK si no hace falta. */
export function describeAiError(err: unknown): string {
  if (err instanceof AiError) return err.message;
  return err instanceof Error ? err.message : 'Error desconocido al analizar la imagen.';
}
