import type { IsoDate } from './types';

/** Fecha local en YYYY-MM-DD. Nunca toISOString(): eso desplaza el día. */
export function toIsoDate(d: Date = new Date()): IsoDate {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fromIsoDate(s: IsoDate): Date {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(s: IsoDate, n: number): IsoDate {
  const d = fromIsoDate(s);
  d.setDate(d.getDate() + n);
  return toIsoDate(d);
}

export function daysBetween(a: IsoDate, b: IsoDate): number {
  const ms = fromIsoDate(b).getTime() - fromIsoDate(a).getTime();
  return Math.round(ms / 86400000);
}

/** Lunes de la semana a la que pertenece la fecha (semana ISO, empieza lunes). */
export function weekStart(s: IsoDate): IsoDate {
  const d = fromIsoDate(s);
  const dow = (d.getDay() + 6) % 7; // 0 = lunes
  d.setDate(d.getDate() - dow);
  return toIsoDate(d);
}

/** Rango [desde, hasta] de los últimos n días, incluyendo hoy. */
export function lastNDays(n: number, end: IsoDate = toIsoDate()): IsoDate[] {
  const out: IsoDate[] = [];
  for (let i = n - 1; i >= 0; i--) out.push(addDays(end, -i));
  return out;
}

export function nowTime(d: Date = new Date()): string {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

export function timeToMinutes(t: string): number {
  const [h, m] = t.split(':').map(Number);
  return h * 60 + (m || 0);
}

const DOW = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
const MONTH = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];

export function formatDayLabel(s: IsoDate, today: IsoDate = toIsoDate()): string {
  if (s === today) return 'Hoy';
  if (s === addDays(today, -1)) return 'Ayer';
  const d = fromIsoDate(s);
  return `${DOW[(d.getDay() + 6) % 7]} ${d.getDate()} ${MONTH[d.getMonth()]}`;
}

export function formatShortDate(s: IsoDate): string {
  const d = fromIsoDate(s);
  return `${d.getDate()}/${d.getMonth() + 1}`;
}
