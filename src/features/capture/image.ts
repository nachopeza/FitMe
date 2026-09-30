/**
 * Preparación de imágenes. Va en su propio módulo, sin dependencias del SDK de
 * IA, para que fotografiar y previsualizar no arrastre nada al paquete inicial.
 */

export interface ImagePayload {
  /** Base64 sin el prefijo "data:". */
  data: string;
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp';
}

/**
 * Reduce y comprime la foto. Una foto de móvil son 4-8 MB; a 1024 px de lado
 * mayor baja a unos 150 KB sin perder el detalle útil para estimar una ración,
 * y la petición cuesta bastante menos.
 */
export async function prepareImage(file: Blob, maxSide = 1024): Promise<ImagePayload> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('No se ha podido procesar la imagen.');
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL('image/jpeg', 0.82);
  return { data: dataUrl.split(',')[1] ?? '', mediaType: 'image/jpeg' };
}

export function payloadToDataUrl(p: ImagePayload): string {
  return `data:${p.mediaType};base64,${p.data}`;
}
