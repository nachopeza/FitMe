import { useEffect, useRef, useState } from 'react';
import { formatSeconds } from '../../domain/workout';

/**
 * Temporizador de descanso.
 *
 * Cuenta contra una marca de tiempo absoluta, no sumando segundos: si el móvil
 * bloquea la pantalla o el navegador congela el temporizador, al volver muestra
 * el tiempo correcto en lugar de haberse quedado parado.
 */
export function RestTimer({
  endsAt, total, onDismiss, onAdd,
}: {
  endsAt: number;
  total: number;
  onDismiss: () => void;
  onAdd: (seconds: number) => void;
}) {
  const [now, setNow] = useState(() => Date.now());
  const beeped = useRef(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), 250);
    return () => window.clearInterval(id);
  }, []);

  // Hacia arriba: un descanso de tres minutos empieza enseñando 3:00, no 2:59.
  const left = Math.max(0, Math.ceil((endsAt - now) / 1000));
  const pct = total > 0 ? Math.max(0, Math.min(100, (left / total) * 100)) : 0;

  useEffect(() => {
    if (left === 0 && !beeped.current) {
      beeped.current = true;
      // Vibración corta al terminar. No todos los navegadores la permiten, y si
      // no está disponible simplemente no pasa nada.
      try {
        navigator.vibrate?.([120, 60, 120]);
      } catch {
        /* sin vibración */
      }
    }
  }, [left]);

  return (
    <div className="rest" role="timer" aria-live="off">
      {/* La barra marca cuánto queda sin tener que leer el número. */}
      <span className="rest-bar"><span style={{ width: `${pct}%` }} /></span>
      <span className="rest-time">{left > 0 ? formatSeconds(left) : '¡Vamos!'}</span>
      <div className="rest-actions">
        <button onClick={() => onAdd(-15)} aria-label="Quitar quince segundos">−15</button>
        <button onClick={() => onAdd(15)} aria-label="Añadir quince segundos">+15</button>
        <button className="rest-skip" onClick={onDismiss} aria-label="Omitir el descanso">Omitir</button>
      </div>
    </div>
  );
}
