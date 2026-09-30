/**
 * Acceso a la Web Speech API del navegador.
 *
 * El reconocimiento de voz lo hace el propio navegador (en Chrome y Safari con
 * soporte del sistema), así que el dictado no depende de ninguna API de pago.
 * La interpretación de lo dictado la hace el parser local.
 */

interface SpeechAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechResult {
  0: SpeechAlternative;
  isFinal: boolean;
  length: number;
}
interface SpeechEvent extends Event {
  resultIndex: number;
  results: { length: number; [i: number]: SpeechResult };
}
interface SpeechErrorEvent extends Event {
  error: string;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechEvent) => void) | null;
  onerror: ((e: SpeechErrorEvent) => void) | null;
  onend: (() => void) | null;
  onstart: (() => void) | null;
}
type SpeechCtor = new () => SpeechRecognitionLike;

function getCtor(): SpeechCtor | null {
  const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechSupported(): boolean {
  return getCtor() !== null;
}

export interface SpeechSession {
  stop: () => void;
}

export interface SpeechHandlers {
  onPartial: (text: string) => void;
  onFinal: (text: string) => void;
  onError: (message: string) => void;
  onEnd: () => void;
}

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'El navegador ha bloqueado el micrófono. Dale permiso y vuelve a intentarlo.',
  'service-not-allowed': 'El sistema ha bloqueado el reconocimiento de voz.',
  'no-speech': 'No he oído nada. Prueba otra vez, más cerca del micrófono.',
  'audio-capture': 'No encuentro ningún micrófono disponible.',
  network: 'El reconocimiento de voz necesita conexión en este navegador.',
  aborted: '',
};

/** Arranca el dictado en español. Devuelve null si el navegador no lo soporta. */
export function startDictation(handlers: SpeechHandlers): SpeechSession | null {
  const Ctor = getCtor();
  if (!Ctor) return null;

  const rec = new Ctor();
  rec.lang = 'es-ES';
  rec.continuous = true;
  rec.interimResults = true;
  rec.maxAlternatives = 1;

  let finalText = '';

  rec.onresult = (e) => {
    let interim = '';
    for (let i = e.resultIndex; i < e.results.length; i++) {
      const res = e.results[i];
      if (res.isFinal) finalText += `${res[0].transcript} `;
      else interim += res[0].transcript;
    }
    handlers.onPartial(`${finalText}${interim}`.trim());
  };
  rec.onerror = (e) => {
    const msg = ERROR_MESSAGES[e.error] ?? `Error de reconocimiento: ${e.error}`;
    if (msg) handlers.onError(msg);
  };
  rec.onend = () => {
    if (finalText.trim()) handlers.onFinal(finalText.trim());
    handlers.onEnd();
  };

  try {
    rec.start();
  } catch {
    handlers.onError('No se ha podido iniciar el micrófono.');
    return null;
  }
  return { stop: () => rec.stop() };
}
