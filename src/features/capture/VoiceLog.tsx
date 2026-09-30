import { useEffect, useRef, useState } from 'react';
import { parsePhrase, type ParseResult } from '../../domain/parser';
import { EstimateNotice, Sheet } from '../../ui/components';
import { useApp } from '../store';
import { itemsFromParsed } from '../logging';
import { ConfirmEntry } from './ConfirmEntry';
import { isSpeechSupported, startDictation, type SpeechSession } from './speech';

/**
 * Registro por voz.
 *
 * Dos fases claras: primero se dicta y se ve la transcripción; después la app
 * muestra QUÉ HA ENTENDIDO y se confirma o edita. Nunca guarda sin confirmación.
 *
 * Si el navegador no tiene reconocimiento de voz, el mismo cuadro acepta texto
 * escrito: el parser es el mismo, así que la función no se pierde.
 */
export function VoiceLog({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const supported = isSpeechSupported();
  const [listening, setListening] = useState(false);
  const [text, setText] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [parsed, setParsed] = useState<ParseResult | null>(null);
  const session = useRef<SpeechSession | null>(null);

  useEffect(() => () => session.current?.stop(), []);

  const toggle = () => {
    if (listening) {
      session.current?.stop();
      setListening(false);
      return;
    }
    setError(null);
    const s = startDictation({
      onPartial: setText,
      onFinal: setText,
      onError: (msg) => {
        setError(msg);
        setListening(false);
      },
      onEnd: () => setListening(false),
    });
    if (s) {
      session.current = s;
      setListening(true);
    }
  };

  const analyse = () => {
    const result = parsePhrase(text, app.foodIndex);
    setParsed(result);
  };

  if (parsed) {
    return (
      <ConfirmEntry
        title="He entendido"
        subtitle="Revisa las cantidades antes de guardar"
        initialItems={itemsFromParsed(parsed.items, app.foodsById)}
        unmatched={parsed.unmatched}
        sourceNote={parsed.transcript}
        method="voice"
        slot={parsed.slot}
        onClose={onClose}
        notice={
          <EstimateNotice>
            Lo que no has dicho en gramos va estimado a partir de raciones habituales. Un «plato de arroz» no
            es un dato exacto: puedes corregirlo debajo.
          </EstimateNotice>
        }
      />
    );
  }

  return (
    <Sheet
      title="🎤 Registrar por voz"
      subtitle={supported ? 'Di lo que has comido, con naturalidad' : 'Escribe lo que has comido'}
      onClose={onClose}
      footer={
        <button className="btn primary" disabled={!text.trim()} onClick={analyse}>
          Analizar lo que he dicho
        </button>
      }
    >
      {supported ? (
        <>
          <button
            className={`mic-btn${listening ? ' listening' : ''}`}
            onClick={toggle}
            aria-label={listening ? 'Parar de dictar' : 'Empezar a dictar'}
          >
            {listening ? '■' : '🎤'}
          </button>
          <p className="note" style={{ textAlign: 'center' }}>
            {listening ? 'Te escucho… toca para parar.' : 'Toca el micrófono y habla.'}
          </p>
        </>
      ) : (
        <div className="estimate" style={{ marginBottom: 12 }}>
          <span aria-hidden="true">ℹ️</span>
          <div>
            Este navegador no tiene reconocimiento de voz. Escribe la frase igual que la dirías: la app la
            interpreta con el mismo sistema.
          </div>
        </div>
      )}

      {error && (
        <div className="estimate" style={{ marginBottom: 12, borderColor: 'var(--bad)' }}>
          <span aria-hidden="true">⚠️</span>
          <div>{error}</div>
        </div>
      )}

      <div className="field">
        <label>{supported ? 'Transcripción (puedes corregirla)' : 'Lo que has comido'}</label>
        <textarea
          className="input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="He comido arroz con unos cien gramos de carne picada de pollo, dos huevos, tomate aliñado y un café con leche de soja."
          rows={4}
        />
      </div>

      <div className="card tight">
        <div className="card-title"><span>Ejemplos que entiende</span></div>
        <div className="chips">
          {EXAMPLES.map((ex) => (
            <button key={ex} className="chip" onClick={() => setText(ex)}>{ex}</button>
          ))}
        </div>
      </div>

      <p className="note">
        Entiende cantidades en gramos y en kilos, números escritos con letra («cien gramos», «dos huevos»),
        raciones («un plato de», «dos lonchas», «una lata»), «medio» y «un par de». Si dices «arroz crudo»
        usará el arroz crudo, y si no, el cocinado: no son lo mismo.
      </p>
    </Sheet>
  );
}

const EXAMPLES = [
  'Arroz con pollo y tomate',
  'Dos huevos con pan y atún',
  '150 g de pollo y un plato de pasta',
  'Yogur con cereales y un plátano',
  'Un café con leche de soja',
];
