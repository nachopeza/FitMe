/**
 * El anillo del día.
 *
 * Es el gancho de la pantalla: de un vistazo se ve cuánto lleva cargado el día
 * y de qué, porque cada tramo va en el color de su disco. En el centro, lo único
 * que de verdad importa aquí: lo que falta por comer.
 *
 * El trazo se dibuja con tres círculos superpuestos y `stroke-dasharray`, que es
 * la forma barata de hacer un anillo segmentado sin calcular arcos a mano.
 */

const R = 52;
const C = 2 * Math.PI * R;

export interface RingSegment {
  key: 'protein' | 'carbs' | 'fat';
  /** Energía aportada por ese macro, en kcal. */
  kcal: number;
}

export function Ring({
  segments, target, children, size = 236,
}: {
  segments: RingSegment[];
  /** Objetivo de energía del día, en kcal. */
  target: number;
  children: React.ReactNode;
  size?: number;
}) {
  const safeTarget = Math.max(1, target);
  // Lo comido puede pasarse del objetivo; el anillo se llena como mucho entero.
  const total = segments.reduce((a, s) => a + Math.max(0, s.kcal), 0);
  const scale = total > safeTarget ? safeTarget / total : 1;

  let offset = 0;
  const arcs = segments.map((s) => {
    const fraction = (Math.max(0, s.kcal) * scale) / safeTarget;
    const arc = { key: s.key, length: fraction * C, offset: offset * C };
    offset += fraction;
    return arc;
  });

  return (
    <div className="ring" style={{ width: size, height: size }}>
      <svg viewBox="0 0 120 120" aria-hidden="true">
        <circle className="ring-track" cx="60" cy="60" r={R} />
        {arcs.map((a) => (
          <circle
            key={a.key}
            className={`ring-arc ring-${a.key}`}
            cx="60"
            cy="60"
            r={R}
            strokeDasharray={`${a.length} ${C - a.length}`}
            strokeDashoffset={-a.offset}
          />
        ))}
      </svg>
      <div className="ring-center">{children}</div>
    </div>
  );
}


/**
 * Anillo pequeño de una comida.
 *
 * Un solo tramo —la energía de esa franja— y el número de kcal dentro. Puesto
 * en fila, el día entero se lee de un vistazo y se ve en qué comida se queda
 * corto, que es justo lo que no decía una cifra única del día.
 */
export function MiniRing({
  value, target, tone = 'accent', size = 46, label,
}: {
  value: number;
  target: number;
  tone?: 'accent' | 'behind' | 'done';
  size?: number;
  label?: string;
}) {
  const r = 20;
  const c = 2 * Math.PI * r;
  const fraction = target > 0 ? Math.min(1, Math.max(0, value / target)) : 0;
  return (
    <span className={`mini-ring tone-${tone}`} style={{ width: size, height: size }} role="img"
      aria-label={label ?? `${Math.round(fraction * 100)}% de la comida`}>
      <svg viewBox="0 0 48 48">
        <circle className="mini-track" cx="24" cy="24" r={r} />
        <circle
          className="mini-arc"
          cx="24"
          cy="24"
          r={r}
          strokeDasharray={`${fraction * c} ${c - fraction * c}`}
        />
      </svg>
    </span>
  );
}
