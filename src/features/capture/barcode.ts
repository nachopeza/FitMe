/**
 * Lectura de códigos de barras desde la cámara.
 *
 * Dos implementaciones, en este orden:
 *   1. BarcodeDetector nativo del navegador (Chrome en Android, Edge). Es el
 *      más rápido y no descarga nada.
 *   2. ZXing en JavaScript, que funciona en todos los navegadores, incluido
 *      Safari en iOS.
 *
 * Ninguna de las dos envía la imagen a ningún sitio: el procesado es local.
 */

export type ScannerKind = 'native' | 'zxing';

export interface ScanHandle {
  stop: () => void;
  kind: ScannerKind;
}

interface NativeDetector {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
}
interface NativeDetectorCtor {
  new (opts?: { formats?: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
}

const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39'];

function nativeCtor(): NativeDetectorCtor | null {
  const w = window as unknown as { BarcodeDetector?: NativeDetectorCtor };
  return w.BarcodeDetector ?? null;
}

export function hasNativeScanner(): boolean {
  return nativeCtor() !== null;
}

/**
 * Arranca el escaneo sobre un elemento <video> que ya tiene la cámara abierta.
 * Llama a `onCode` con el primer código estable que encuentre.
 */
export async function startScanning(
  video: HTMLVideoElement,
  onCode: (code: string) => void,
  onError: (message: string) => void,
): Promise<ScanHandle> {
  const Ctor = nativeCtor();
  if (Ctor) {
    const detector = new Ctor({ formats: FORMATS });
    let raf = 0;
    let stopped = false;
    // Se exige leer el mismo código dos veces seguidas: evita falsos positivos.
    let lastCode: string | null = null;

    const loop = async () => {
      if (stopped) return;
      try {
        const results = await detector.detect(video);
        const code = results[0]?.rawValue;
        if (code) {
          if (code === lastCode) {
            stopped = true;
            onCode(code);
            return;
          }
          lastCode = code;
        }
      } catch {
        // Un fotograma ilegible no es un error: se sigue intentando.
      }
      raf = requestAnimationFrame(() => void loop());
    };
    void loop();
    return {
      kind: 'native',
      stop: () => {
        stopped = true;
        cancelAnimationFrame(raf);
      },
    };
  }

  // Respaldo con ZXing, cargado solo cuando hace falta.
  try {
    const { BrowserMultiFormatReader } = await import('@zxing/browser');
    const reader = new BrowserMultiFormatReader();
    let stopped = false;
    const controls = await reader.decodeFromVideoElement(video, (result) => {
      if (stopped || !result) return;
      stopped = true;
      onCode(result.getText());
    });
    return {
      kind: 'zxing',
      stop: () => {
        stopped = true;
        controls.stop();
      },
    };
  } catch (err) {
    onError(
      err instanceof Error && /permission|NotAllowed/i.test(err.message)
        ? 'No hay permiso para usar la cámara.'
        : 'No se ha podido iniciar el lector de códigos en este navegador.',
    );
    return { kind: 'zxing', stop: () => {} };
  }
}

/** Abre la cámara trasera en el elemento de vídeo indicado. */
export async function openCamera(video: HTMLVideoElement): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error('Este navegador no da acceso a la cámara.');
  }
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
    audio: false,
  });
  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  await video.play();
  return stream;
}

export function closeCamera(stream: MediaStream | null) {
  stream?.getTracks().forEach((t) => t.stop());
}
