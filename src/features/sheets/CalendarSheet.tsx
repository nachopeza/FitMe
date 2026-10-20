import { useMemo, useState } from 'react';
import { toIsoDate } from '../../domain/dates';
import { Sheet } from '../../ui/components';
import { Icon } from '../../ui/icons';
import { useUI } from '../../ui/shell';
import { useApp } from '../store';

const MONTHS = [
  'enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio',
  'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre',
];
/** La semana empieza en lunes, como aquí. */
const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * El mes de un vistazo.
 *
 * Dos señales por día: si comiste registrando y si entrenaste. Puesto en
 * cuadrícula se ven las rachas y los huecos sin leer un solo número, que es
 * para lo que sirve un calendario y no una lista.
 */
export function CalendarSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const ui = useUI();
  const today = toIsoDate();
  const [cursor, setCursor] = useState(() => {
    const [y, m] = today.split('-').map(Number);
    return { year: y, month: m - 1 };
  });

  const trained = useMemo(
    () => new Set(app.workouts.filter((w) => w.finishedAt).map((w) => w.date)),
    [app.workouts],
  );

  const days = useMemo(() => {
    const first = new Date(Date.UTC(cursor.year, cursor.month, 1));
    const total = new Date(Date.UTC(cursor.year, cursor.month + 1, 0)).getUTCDate();
    // getUTCDay da 0 para domingo; aquí la semana empieza en lunes.
    const offset = (first.getUTCDay() + 6) % 7;
    const cells: ({ date: string; day: number } | null)[] = Array.from({ length: offset }, () => null);
    for (let d = 1; d <= total; d++) {
      const date = `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
      cells.push({ date, day: d });
    }
    return cells;
  }, [cursor]);

  const move = (delta: number) => setCursor((c) => {
    const m = c.month + delta;
    if (m < 0) return { year: c.year - 1, month: 11 };
    if (m > 11) return { year: c.year + 1, month: 0 };
    return { year: c.year, month: m };
  });

  const inMonth = days.filter((c): c is { date: string; day: number } => !!c);
  const logged = inMonth.filter((c) => app.daysWithFood.has(c.date)).length;
  const sessions = inMonth.filter((c) => trained.has(c.date)).length;

  return (
    <Sheet title="Calendario" onClose={onClose}>
      <div className="cal-head">
        <button className="icon-btn" aria-label="Mes anterior" onClick={() => move(-1)}>
          <span style={{ transform: 'rotate(180deg)', display: 'grid' }}><Icon name="chevron" size={18} /></span>
        </button>
        <span className="cal-month">{MONTHS[cursor.month]} {cursor.year}</span>
        <button className="icon-btn" aria-label="Mes siguiente" onClick={() => move(1)}>
          <Icon name="chevron" size={18} />
        </button>
      </div>

      <div className="cal-grid" role="grid">
        {WEEKDAYS.map((d, i) => (
          <span className="cal-wd" key={`wd-${i}`} aria-hidden="true">{d}</span>
        ))}
        {days.map((cell, i) => {
          if (!cell) return <span key={`gap-${i}`} />;
          const ate = app.daysWithFood.has(cell.date);
          const gym = trained.has(cell.date);
          const isToday = cell.date === today;
          const future = cell.date > today;
          return (
            <button
              className={`cal-day${isToday ? ' is-today' : ''}${future ? ' is-future' : ''}`}
              key={cell.date}
              disabled={future}
              aria-label={`${cell.day} de ${MONTHS[cursor.month]}`
                + `${ate ? ', con comidas registradas' : ''}${gym ? ', con entrenamiento' : ''}`}
              onClick={() => { app.setDate(cell.date); ui.setTab('today'); onClose(); }}
            >
              <span className="cal-num">{cell.day}</span>
              <span className="cal-dots">
                {ate && <i className="dot-ate" />}
                {gym && <i className="dot-gym" />}
              </span>
            </button>
          );
        })}
      </div>

      <div className="cal-legend">
        <span><i className="dot-ate" />Registraste comida</span>
        <span><i className="dot-gym" />Entrenaste</span>
      </div>

      <p className="note">
        En {MONTHS[cursor.month]} llevas <b>{logged}</b> {logged === 1 ? 'día' : 'días'} con comida
        registrada y <b>{sessions}</b> {sessions === 1 ? 'sesión' : 'sesiones'}. Toca un día para abrirlo.
      </p>
    </Sheet>
  );
}
