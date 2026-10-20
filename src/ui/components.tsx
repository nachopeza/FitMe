import {
  cloneElement, isValidElement, useEffect, useId, useRef, useState,
  type ReactElement, type ReactNode,
} from 'react';
import { STATUS_TEXT, macroStatus, type MacroStatus } from '../domain/nutrition';
import type { MacroKey, Nutrients, TargetRange } from '../domain/types';

/**
 * Piezas compartidas de la interfaz.
 *
 * Dos cambios de criterio respecto a la primera versión:
 *
 * - Fuera los emoji como marcadores. Llenaban las celdas, descuadraban las
 *   cajas estrechas y cada sistema los dibuja distinto. Las etiquetas de texto
 *   dicen lo mismo y caben.
 * - Fuera el color por macro. Había cinco tintas compitiendo; ahora la energía y
 *   la proteína llevan el acento, porque son lo que condiciona el objetivo, y el
 *   resto va en grises graduados.
 */

export const MACRO_META: Record<MacroKey, { label: string; short: string; unit: string; color: string }> = {
  kcal: { label: 'Calorías', short: 'kcal', unit: 'kcal', color: 'var(--m-kcal)' },
  protein: { label: 'Proteína', short: 'prot', unit: 'g', color: 'var(--m-protein)' },
  carbs: { label: 'Carbohidratos', short: 'carb', unit: 'g', color: 'var(--m-carbs)' },
  fat: { label: 'Grasas', short: 'gras', unit: 'g', color: 'var(--m-fat)' },
  fiber: { label: 'Fibra', short: 'fibra', unit: 'g', color: 'var(--m-fiber)' },
};

export function fmt(n: number, decimals = 0): string {
  return n.toLocaleString('es-ES', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** Entero con separador de miles español. */
export function g(n: number): string {
  return fmt(Math.round(n));
}

// ───────────────────────────── Secciones ─────────────────────────────

export function Section({
  title, aside, children, action,
}: { title: string; aside?: ReactNode; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="section">
      <div className="section-head">
        <h2 className="section-title">{title}</h2>
        {action ?? (aside ? <span className="section-aside">{aside}</span> : null)}
      </div>
      {children}
    </section>
  );
}

export function Card({ children }: { children: ReactNode }) {
  return <div className="card">{children}</div>;
}

// ───────────────────────────── Barra de macro ─────────────────────────────

/**
 * Barra con el rango aceptable marcado.
 *
 * No representa "cumplido o no", sino dónde caes dentro de una franja
 * razonable. El eje llega al mayor entre el límite alto y lo consumido, para
 * que pasarse se vea sin que la barra reviente.
 */
export function MacroBar({
  macro, value, range, showRange = true,
}: { macro: MacroKey; value: number; range: TargetRange; showRange?: boolean }) {
  const meta = MACRO_META[macro];
  const status = macroStatus(value, range);
  const axis = Math.max(range.max * 1.1, value * 1.02, 1);
  const pct = (v: number) => `${Math.min(100, (v / axis) * 100)}%`;

  return (
    <div className="macro">
      <div className="macro-top">
        <span className="macro-name">{meta.label}</span>
        <span className="macro-read">
          <b>{g(value)}</b> / {g(range.target)} {meta.unit}
        </span>
      </div>
      <div
        className="track"
        role="meter"
        aria-valuenow={Math.round(value)}
        aria-valuemin={0}
        aria-valuemax={Math.round(range.max)}
        aria-label={`${meta.label}: ${g(value)} de ${g(range.target)} ${meta.unit}. ${STATUS_TEXT[status]}.`}
      >
        <span className="track-band" style={{ left: pct(range.min), width: `calc(${pct(range.max)} - ${pct(range.min)})` }} />
        <span className="track-fill" style={{ width: pct(value), background: meta.color }} />
      </div>
      {showRange && (
        <div className="macro-foot">
          <span>Rango {g(range.min)}–{g(range.max)}</span>
          <span style={{ color: status === 'over' ? 'var(--over)' : undefined }}>{STATUS_TEXT[status]}</span>
        </div>
      )}
    </div>
  );
}

export const STATUS_TONE: Record<MacroStatus, string> = {
  under: 'var(--ink-3)',
  inRange: 'var(--accent)',
  nearLimit: 'var(--warn)',
  over: 'var(--over)',
};

// ───────────────────────────── Píldoras de macros ─────────────────────────────

export function MacroPills({
  n, keys = ['kcal', 'protein', 'carbs', 'fat', 'fiber'],
}: { n: Nutrients; keys?: MacroKey[] }) {
  return (
    <div className="pills">
      {keys.map((k) => (
        <span className={`pill${k === 'kcal' || k === 'protein' ? ' lead' : ''}`} key={k}>
          {g(n[k])}{k === 'kcal' ? ' kcal' : ' g'} {MACRO_META[k].short}
        </span>
      ))}
    </div>
  );
}

// ───────────────────────────── Hoja inferior ─────────────────────────────

export function Sheet({
  title, subtitle, onClose, children, footer, accent,
}: {
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  footer?: ReactNode;
  /** 'iron' viste la cabecera del material del entreno. */
  accent?: 'iron';
}) {
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
      <div className={`sheet${accent ? ` sheet-${accent}` : ''}`} role="dialog" aria-modal="true"
        aria-label={title} ref={ref} tabIndex={-1}>
        <div className="sheet-grab" />
        <div className="sheet-head">
          <div style={{ minWidth: 0 }}>
            <h2>{title}</h2>
            {subtitle && <div className="sheet-sub">{subtitle}</div>}
          </div>
          <button className="icon-btn" onClick={onClose} aria-label="Cerrar">
            <Close />
          </button>
        </div>
        <div className="sheet-body">{children}</div>
        {footer && <div className="sheet-foot">{footer}</div>}
      </div>
    </>
  );
}

function Close() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
      strokeLinecap="round" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

// ───────────────────────────── Controles ─────────────────────────────

/**
 * Un campo con su etiqueta.
 *
 * La etiqueta se ASOCIA al control: antes era un <span> suelto, así que un
 * lector de pantalla leía el campo sin saber de qué era, y nada podía
 * localizarlo por su nombre. Cuando el hijo es un único elemento se le pasa un
 * id generado y la etiqueta apunta a él; con varios hijos (una fila de chips,
 * por ejemplo) se deja sin asociar, que es lo correcto ahí.
 */
export function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  const generated = useId();
  const single = isValidElement(children) ? (children as ReactElement<{ id?: string }>) : null;
  const id = single?.props.id ?? generated;
  const child = single ? cloneElement(single, { id }) : children;
  return (
    <div className="field">
      <label className="field-label" htmlFor={single ? id : undefined}>{label}</label>
      {child}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  value, options, onChange, label,
}: { value: T; options: { value: T; label: string }[]; onChange: (v: T) => void; label?: string }) {
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

interface NumberInputProps {
  /** Lo inyecta `Field` para poder asociarle su etiqueta. */
  id?: string;
  value: number | '';
  /** Se llama con el valor confirmado. Nunca con una cadena vacía. */
  onChange: (v: number) => void;
  suffix?: string;
  step?: number;
  min?: number;
  max?: number;
  placeholder?: string;
  label?: string;
  /**
   * `blur` confirma al salir del campo o al pulsar Enter; `change`, en cada
   * pulsación válida.
   *
   * Por defecto `blur`, y es importante: confirmando en cada pulsación, cada
   * tecla guardaba en la base de datos y el valor recién guardado se repintaba
   * encima de lo que se estaba escribiendo. Borrar el campo para teclear otro
   * número era imposible.
   */
  commitOn?: 'blur' | 'change';
}

export function NumberInput({
  id, value, onChange, suffix, step = 1, min, max, placeholder, label, commitOn = 'blur',
}: NumberInputProps) {
  const [text, setText] = useState(value === '' ? '' : String(value));
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!editing) setText(value === '' ? '' : String(value));
  }, [value, editing]);

  const parse = (raw: string): number | null => {
    // Se acepta la coma decimal: es lo que da el teclado español.
    const n = Number(raw.replace(',', '.'));
    if (raw.trim() === '' || !Number.isFinite(n)) return null;
    if (min != null && n < min) return min;
    if (max != null && n > max) return max;
    return n;
  };

  const commit = () => {
    const n = parse(text);
    if (n == null) {
      setText(value === '' ? '' : String(value));
      return;
    }
    setText(String(n));
    onChange(n);
  };

  return (
    <div className="input-row">
      <input
        id={id}
        className="input"
        type="text"
        inputMode="decimal"
        value={text}
        step={step}
        placeholder={placeholder}
        aria-label={label}
        onFocus={() => setEditing(true)}
        onChange={(e) => {
          const raw = e.target.value;
          if (!/^-?[0-9]*[.,]?[0-9]*$/.test(raw)) return;
          setText(raw);
          if (commitOn === 'change') {
            const n = parse(raw);
            if (n != null) onChange(n);
          }
        }}
        onBlur={() => {
          setEditing(false);
          commit();
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') e.currentTarget.blur();
        }}
      />
      {suffix && <span className="suffix">{suffix}</span>}
    </div>
  );
}

/** Aviso de estimación: la app dice siempre cuándo no sabe con exactitud. */
export function EstimateNotice({ children, alert = false }: { children: ReactNode; alert?: boolean }) {
  return (
    <div className={`estimate${alert ? ' alert' : ''}`}>
      <div>{children}</div>
    </div>
  );
}

export function Empty({ title, children }: { title?: string; children: ReactNode }) {
  return (
    <div className="empty">
      {title && <strong>{title}</strong>}
      {children}
    </div>
  );
}

/** Toda recomendación importante se puede auditar. */
export function WhyButton({ reasons, label = '¿Por qué?' }: { reasons: string[]; label?: string }) {
  const [open, setOpen] = useState(false);
  if (!reasons.length) return null;
  return (
    <div>
      <button className="link" onClick={() => setOpen(!open)} aria-expanded={open}>
        {open ? 'Ocultar' : label}
      </button>
      {open && (
        <div className="sugg-why" style={{ marginTop: 8, marginBottom: 0 }}>
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

/** Cifra suelta: etiqueta, valor y apunte. */
export function Figure({
  label, value, sub, text = false,
}: { label: string; value: string; sub?: string; text?: boolean }) {
  return (
    <div className="figure">
      <div className="figure-label">{label}</div>
      <div className={`figure-value${text ? ' text' : ''}`}>{value}</div>
      {sub && <div className="figure-sub">{sub}</div>}
    </div>
  );
}
