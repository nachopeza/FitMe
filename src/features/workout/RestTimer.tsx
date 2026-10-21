import { useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { formatSeconds } from '../../domain/workout';

/**
 * Temporizador de descanso.
 *
 * Cuenta contra una marca de tiempo absoluta, no sumando segundos: si el móvil
 * bloquea la pantalla o el navegador congela el temporizador, al volver muestra
 * el tiempo correcto en lugar de haberse quedado parado.
 */
export function RestTimer({
  endsAt, total, label, done = '¡Vamos!', dismiss = 'Omitir', compact = false, onDismiss, onAdd,
}: {
  endsAt: number;
  total: number;
  /** Con dos cuentas a la vez hay que poder distinguirlas de un vistazo. */
  label?: string;
  /** Qué pone al llegar a cero. */
  done?: string;
  /** El verbo del botón: un descanso se omite, un temporizador se para. */
  dismiss?: string;
  /** Con dos cuentas en pantalla, la cifra a tamaño completo se come el móvil. */
  compact?: boolean;
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
    <div className={`rest${compact ? ' compact' : ''}`} role="timer" aria-live="off">
      {/* La barra marca cuánto queda sin tener que leer el número. */}
      <span className="rest-bar"><span style={{ width: `${pct}%` }} /></span>
      {label && <span className="rest-label">{label}</span>}
      <span className="rest-time">{left > 0 ? formatSeconds(left) : done}</span>
      <div className="rest-actions">
        <button onClick={() => onAdd(-15)} aria-label={`Quitar quince segundos${label ? ` de ${label}` : ''}`}>−15</button>
        <button onClick={() => onAdd(15)} aria-label={`Añadir quince segundos${label ? ` a ${label}` : ''}`}>+15</button>
        <button className="rest-skip" onClick={onDismiss}
          aria-label={`${dismiss} ${label ?? 'el descanso'}`}>
          {dismiss}
        </button>
      </div>
    </div>
  );
}

/**
 * Las cuentas atrás flotan sobre el contenido, así que tapan el final de lo que
 * hay debajo: con el descanso en marcha no se llegaba a ver la última serie ni
 * los botones del pie. Esto mide lo que ocupan —desde su borde superior hasta
 * el fondo de la pantalla— y lo publica en --rest-h, que el CSS suma al relleno
 * inferior de lo que se desplaza. Al desmontarse vuelve a 0 y no sobra hueco.
 */
export function TimerStack({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const medir = () => {
      const r = el.getBoundingClientRect();
      const alto = Math.max(0, Math.round(window.innerHeight - r.top));
      document.documentElement.style.setProperty('--rest-h', `${alto}px`);
    };
    medir();
    const ro = new ResizeObserver(medir);
    ro.observe(el);
    window.addEventListener('resize', medir);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', medir);
      document.documentElement.style.removeProperty('--rest-h');
    };
  }, []);

  return <div className="timers" ref={ref}>{children}</div>;
}
