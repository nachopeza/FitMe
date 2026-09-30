import { useEffect, useRef, useState, type ReactNode } from 'react';
import { STATUS_DOT, STATUS_TEXT, macroStatus, type MacroStatus } from '../domain/nutrition';
import type { MacroKey, Nutrients, TargetRange } from '../domain/types';

// ───────────────────────────── Vocabulario visual de macros ─────────────────────────────

export const MACRO_META: Record<MacroKey, { label: string; short: string; icon: string; unit: string; color: string }> = {
  kcal: { label: 'Calorías', short: 'kcal', icon: '🔥', unit: 'kcal', color: 'var(--kcal)' },
  protein: { label: 'Proteína', short: 'Prot', icon: '🥩', unit: 'g', color: 'var(--protein)' },
  carbs: { label: 'Carbohidratos', short: 'Carb', icon: '🍚', unit: 'g', color: 'var(--carbs)' },
  fat: { label: 'Grasas', short: 'Gras', icon: '🥑', unit: 'g', color: 'var(--fat)' },
  fiber: { label: 'Fibra', short: 'Fibra', icon: '🌾', unit: 'g', color: 'var(--fiber)' },
};

const STATUS_CLASS: Record<MacroStatus, string> = {
  under: '',
  inRange: 'ok',
  nearLimit: 'warn',
  over: 'bad',
};

export function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Redondeo de presentación: los gramos a entero, las kcal a entero. */
export function g(n: number): string {
  return fmt(Math.round(n));
}

// ───────────────────────────── Barra de macro con rango ─────────────────────────────

interface MacroBarProps {
  macro: MacroKey;
  value: number;
  range: TargetRange;
  /** Muestra el rango aceptable bajo la barra. */
  showRange?: boolean;
}

/**
 * Barra con el rango aceptable dibujado.
 *
 * La barra no representa "objetivo cumplido o no", sino dónde caes dentro de una
 * franja razonable. El máximo del eje es el mayor entre el límite superior y lo
 * consumido, para que pasarse se vea sin que la barra reviente.
 */
export function MacroBar({ macro, value, range, showRange = true }: MacroBarProps) {
  const meta = MACRO_META[macro];
  const status = macroStatus(value, range);
  const axisMax = Math.max(range.max * 1.12, value * 1.02, 1);
  const pct = (v: number) => `${Math.min(100, (v / axisMax) * 100)}%`;

  return (
    <div className="macro">
      <div className="macro-head">
        <span className="macro-name">
          <span aria-hidden="true">{meta.icon}</span> {meta.label}
        </span>
        <span className="macro-val">
          <b>{g(value)}</b> <span>/ {g(range.target)} {meta.unit}</span>
        </span>
      </div>
      <div
        className="bar"
        role="meter"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={Math.round(range.max)}
        aria-label={`${meta.label}: ${g(value)} de ${g(range.target)} ${meta.unit}. ${STATUS_TEXT[status]}.`}
      >
        <span
          className="bar-range"
          style={{ left: pct(range.min), width: `calc(${pct(range.max)} - ${pct(range.min)})` }}
        />
        <span className="bar-fill" style={{ width: pct(value), background: meta.color }} />
        <span className="bar-target" style={{ left: pct(range.target) }} />
      </div>
      {showRange && (
        <div className="macro-foot">
          <span>
            Rango {g(range.min)}–{g(range.max)} {meta.unit}
          </span>
          <span className={`tag ${STATUS_CLASS[status]}`}>
            {STATUS_DOT[status]} {STATUS_TEXT[status]}
          </span>
        </div>
      )}
    </div>
  );
}

// ───────────────────────────── Anillo de calorías ─────────────────────────────

export function KcalRing({ value, range, size = 104 }: { value: number; range: TargetRange; size?: number }) {
  const stroke = 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const ratio = range.target > 0 ? Math.min(1.25, value / range.target) : 0;
  const status = macroStatus(value, range);
  const color =
    status === 'over' ? 'var(--bad)' : status === 'nearLimit' ? 'var(--warn)' : 'var(--kcal)';
  return (
    <svg className="ring" width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img"
      aria-label={`${g(value)} de ${g(range.target)} kcal`}>
      <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--bg-elev-2)" strokeWidth={stroke} />
      <circle
        cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke}
        strokeLinecap="round" strokeDasharray={c}
        strokeDashoffset={c * (1 - Math.min(1, ratio))}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
        style={{ transition: 'stroke-dashoffset 0.4s ease' }}
      />
      <text x="50%" y="46%" textAnchor="middle" fill="var(--text)" fontSize="19" fontWeight="700"
        fontFamily="var(--fm)">{g(value)}</text>
      <text x="50%" y="62%" textAnchor="middle" fill="var(--text-faint)" fontSize="10.5">
        de {g(range.target)}
      </text>
      <text x="50%" y="76%" textAnchor="middle" fill="var(--text-faint)" fontSize="9.5">kcal</text>
    </svg>
  );
}

// ───────────────────────────── Píldoras de macros ─────────────────────────────

export function MacroPills({ n, keys = ['kcal', 'protein', 'carbs', 'fat', 'fiber'] }: { n: Nutrients; keys?: MacroKey[] }) {
  return (
    <div className="sugg-macros">
      {keys.map((k) => (
        <span className="pill" key={k} style={{ color: MACRO_META[k].color }}>
          {MACRO_META[k].icon} {g(n[k])}
          {k === 'kcal' ? '' : ' g'}
        </span>
      ))}
    </div>
  );
}

// ───────────────────────────── Hoja inferior ─────────────────────────────

interface SheetProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** Texto de apoyo bajo el título. */
  subtitle?: string;
}

export function Sheet({ title, subtitle, onClose, children, footer }: SheetProps) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    ref.current?.focus();
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return (
    <>
      <div className="sheet-backdrop" onClick={onClose} />
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} ref={ref} tabIndex={-1}>
        <div className="sheet-grab" />
        <div className="sheet-head">
          <div>
            <h2>{title}</h2>
            {subtitle && <div className="screen-sub">{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">✕</button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>
  );
}

// ───────────────────────────── Controles ─────────────────────────────

export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="field">
      <label>{label}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

interface SegmentedProps<T extends string> {
  value: T;
  options: { value: T; label: string }[];
  onChange: (v: T) => void;
  label?: string;
}

export function Segmented<T extends string>({ value, options, onChange, label }: SegmentedProps<T>) {
  return (
    <div className="seg" role="group" aria-label={label}>
      {options.map((o) => (
        <button key={o.value} type="button" aria-pressed={value === o.value} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function NumberInput({
  value, onChange, suffix, step = 1, min = 0, max, placeholder,
}: {
  value: number | '';
  onChange: (v: number | '') => void;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
}) {
  return (
    <div className="input-row">
      <input
        className="input"
        type="number"
        inputMode="decimal"
        value={value}
        step={step}
        min={min}
        max={max}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))}
      />
      {suffix && <span className="suffix">{suffix}</span>}
    </div>
  );
}

/** Aviso reutilizable: la app dice siempre cuándo está estimando. */
export function EstimateNotice({ children }: { children: ReactNode }) {
  return (
    <div className="estimate">
      <span aria-hidden="true">≈</span>
      <div>{children}</div>
    </div>
  );
}

export function Empty({ icon = '🍽️', children }: { icon?: string; children: ReactNode }) {
  return (
    <div className="empty">
      <span className="ico" aria-hidden="true">{icon}</span>
      {children}
    </div>
  );
}

/** Botón "¿Por qué?": toda recomendación importante se puede auditar. */
export function WhyButton({ reasons, label = '¿Por qué?' }: { reasons: string[]; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!reasons.length) return null;
  return (
    <div>
      <button className="link-btn" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? 'Ocultar explicación' : label}
      </button>
      {open && (
        <div className="sugg-why" style={{ marginTop: 8 }}>
          <ul>
            {reasons.map((r, i) => (
              <li key={i}>{r}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}


export function Card({ title, right, children, tight }: { title?: string; right?: ReactNode; children: ReactNode; tight?: boolean }) {
  return (
    <section className={`card${tight ? ' tight' : ''}`}>
      {title && (
        <div className="card-title">
          <span>{title}</span>
          {right}
        </div>
      )}
      {children}
    </section>
  );
}
