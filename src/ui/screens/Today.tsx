import { useMemo } from 'react';
import { addDays, formatDayLabel, toIsoDate } from '../../domain/dates';
import { loggingStreak } from '../../domain/motivation';
import { describeSession, sessionKcal } from '../../domain/training';
import { useApp } from '../../features/store';
import { PlanPanel } from '../../features/plan/PlanPanel';
import { g } from '../components';
import { Icon } from '../icons';
import { TrendArt } from '../FoodArt';
import { useUI } from '../shell';

/** Qué icono lleva el chip de cada macro. */
const MACRO_ICON = { protein: 'dumbbell', carbs: 'wheat', fat: 'drop' } as const;

/**
 * Pantalla de hoy.
 *
 * Cuatro bloques y en este orden: cuánto falta, cómo van los macros, el plan
 * comida a comida y el entreno. Antes había ocho, y tres de ellos —la línea de
 * tiempo, el carrusel de accesos rápidos y el reparto de proteína— decían
 * variaciones de lo mismo. Con un plan escrito delante, lo que hace falta no es
 * sugerir: es enseñar lo que toca y dejarlo registrar de un toque.
 */
export function TodayScreen() {
  const app = useApp();
  const ui = useUI();
  const { targets, consumed, day, profile } = app;

  /**
   * Lo que falta se mide contra el MÍNIMO del rango, no contra el centro.
   *
   * Su objetivo son 2.300–2.500: llegar a 2.300 ya es cumplir, y lo de arriba es
   * margen. Midiendo contra el centro, la barra y el número no coincidían y el
   * día se veía peor de lo que iba, que en alguien que ya come de menos es
   * justo el desánimo que sobra.
   */
  const kcalLeft = Math.max(0, Math.round(targets.kcal.min - consumed.kcal));
  const proteinLeft = Math.max(0, Math.round(targets.protein.min - consumed.protein));
  const done = kcalLeft <= 60 && proteinLeft <= 5;

  const streak = useMemo(
    () => loggingStreak(app.daysWithFood, app.date),
    [app.daysWithFood, app.date],
  );

  const pesoActual = app.weights.at(-1)?.kg ?? profile?.startWeightKg ?? 70;

  return (
    <div className="screen">
      <header className="top rise">
        <div style={{ minWidth: 0 }}>
          <h1 className="screen-title">{app.isToday ? 'Hoy' : formatDayLabel(app.date)}</h1>
          <p className="screen-sub">
            {day?.training ? describeSession(day.training) : 'Lo que toca hoy, según tu plan'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
          {!app.isToday && (
            <button className="top-round" aria-label="Volver a hoy" onClick={() => app.setDate(toIsoDate())}>
              <Icon name="today" size={19} />
            </button>
          )}
          <button className="top-round" aria-label="Abrir el calendario" onClick={() => ui.open({ k: 'calendar' })}>
            <Icon name="calendar" size={19} />
          </button>
        </div>
      </header>

      {/* Los días se cambian con estas flechas, no con la cabecera. */}
      <div className="daynav rise">
        <button className="top-round sm" aria-label="Día anterior" onClick={() => app.setDate(addDays(app.date, -1))}>
          <span style={{ transform: 'rotate(180deg)', display: 'grid' }}><Icon name="chevron" size={16} /></span>
        </button>
        <span>{formatDayLabel(app.date)}</span>
        <button className="top-round sm" aria-label="Día siguiente" disabled={app.date >= toIsoDate()}
          onClick={() => app.setDate(addDays(app.date, 1))}>
          <Icon name="chevron" size={16} />
        </button>
      </div>

      {/* ── Lo que falta: lo único grande de la pantalla ── */}
      <div className="panel tint-mint rise objective">
        <span className="chip-ico c-kcal"><Icon name="target" size={21} /></span>
        <div className="objective-body">
          <div className="objective-label">Objetivo de tu plan</div>
          <div className="objective-figure">
            {g(targets.kcal.min)}–{g(targets.kcal.max)} <span>kcal</span>
          </div>
        </div>
        <div className="objective-left">
          <span>{done ? 'Completado' : 'Faltan'}</span>
          <b>{done ? '¡Listo! 🎉' : `${g(kcalLeft)} kcal`}</b>
        </div>
        <div className="meter" style={{ gridColumn: '1 / -1', marginTop: 14 }}>
          <span style={{ width: `${Math.min(100, (consumed.kcal / Math.max(1, targets.kcal.min)) * 100)}%` }} />
        </div>
      </div>

      {/* ── Macros, en chips de color ── */}
      <div className="panel rise">
        <div className="macro-chips">
          {([
            ['protein', 'Proteína', consumed.protein, targets.protein.min, 'g'],
            ['carbs', 'Carbohidratos', consumed.carbs, targets.carbs.min, 'g'],
            ['fat', 'Grasas', consumed.fat, targets.fat.min, 'g'],
          ] as const).map(([key, label, value, target, unit]) => (
            <button className="macro-chip" key={key} onClick={() => ui.open({ k: 'macros' })}>
              <span className={`chip-ico sm c-${key}`}><Icon name={MACRO_ICON[key]} size={17} /></span>
              <span className="macro-chip-body">
                <span className="macro-chip-name">{label}</span>
                <span className="macro-chip-value">{g(value)} <small>/ {g(target)} {unit}</small></span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Su plan: la columna vertebral ──
          Aquí había tres cosas compitiendo: la línea de tiempo del día, un
          carrusel de accesos rápidos y un botón de añadir. Con el plan delante
          sobran: las cantidades ya están escritas y cada comida es un botón. Lo
          de antes sigue estando, a un toque, en «Añadir otra cosa». */}
      <PlanPanel />

      <button className="btn-outline" style={{ marginBottom: 14 }} onClick={() => ui.open({ k: 'addMenu' })}>
        <Icon name="plus" size={17} /> Añadir algo que no esté en el plan
      </button>

      {/* ── Entrenamiento ── */}
      <div className="panel rise">
        <div className="panel-head">
          <span className="chip-ico sm c-protein"><Icon name="dumbbell" size={17} /></span>
          <h3>Entrenamiento</h3>
          <button className="panel-link" onClick={() => ui.setTab('workout')}>
            Ver rutinas <Icon name="chevron" size={15} />
          </button>
        </div>
        <button className="go-row" onClick={() => ui.setTab('workout')}>
          <span className="go-play"><Icon name="play" size={18} /></span>
          <span className="go-body">
            <span className="go-title">
              {day?.training ? describeSession(day.training) : 'Empezar un entreno'}
            </span>
            <span className="go-meta">
              {day?.training
                ? `${day.training.minutes} min · ~${g(sessionKcal(pesoActual, day.training))} kcal`
                : 'Elige una rutina o empieza vacío'}
            </span>
          </span>
          <Icon name="chevron" size={18} />
        </button>
      </div>

      {/* ── ¿Cómo vas? ── */}
      <div className="panel tint-cream rise cheer">
        <div style={{ minWidth: 0 }}>
          <div className="cheer-title">¿Cómo vas? 📊</div>
          <p className="cheer-msg">
            {done
              ? 'Día cerrado. Mañana, otra vez 💪'
              : streak > 1
                ? `${streak} días seguidos registrando. Mantén el ritmo 💪`
                : 'Marca cada comida del plan y verás el hueco cerrarse.'}
          </p>
        </div>
        <TrendArt />
      </div>
    </div>
  );
}
