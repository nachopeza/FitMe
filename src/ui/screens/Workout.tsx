import { useMemo, useState } from 'react';
import { EXERCISES_BY_ID, MUSCLE_LABEL } from '../../data/exercises';
import { formatDayLabel } from '../../domain/dates';
import type { Exercise, Routine, Workout } from '../../domain/types';
import {
  musclesWorked, totalSets, workoutMinutes, workoutVolume,
} from '../../domain/workout';
import { ActiveWorkout } from '../../features/workout/ActiveWorkout';
import { WorkoutDetail } from '../../features/workout/WorkoutDetail';
import { useApp } from '../../features/store';
import { Section, g } from '../components';
import { Icon } from '../icons';
import { useUI } from '../shell';

/**
 * Apartado de entrenamiento.
 *
 * Tres cosas y en este orden: si hay una sesión abierta, continuarla; si no,
 * empezar una —vacía o desde una rutina—; y debajo, el histórico, que es lo que
 * deja ver si se está progresando.
 */
export function WorkoutScreen() {
  const app = useApp();
  const ui = useUI();
  const [open, setOpen] = useState(false);
  const [detail, setDetail] = useState<Workout | null>(null);

  const live = app.liveWorkout;

  const thisWeek = useMemo(() => {
    const since = Date.now() - 7 * 24 * 3600 * 1000;
    const recent = app.workouts.filter((w) => (w.finishedAt ?? 0) >= since);
    return {
      count: recent.length,
      sets: recent.reduce((a, w) => a + totalSets(w), 0),
      volume: recent.reduce((a, w) => a + workoutVolume(w), 0),
    };
  }, [app.workouts]);

  const start = async (routineId?: string) => {
    await app.actions.startWorkout(routineId ? { routineId } : undefined);
    setOpen(true);
  };

  if (detail) return <WorkoutDetail workout={detail} onClose={() => setDetail(null)} />;

  return (
    <div className="screen">
      <header className="head">
        <div>
          <div className="head-date">Entrenamiento</div>
          <div className="head-note">
            {thisWeek.count > 0
              ? `${thisWeek.count} ${thisWeek.count === 1 ? 'sesión' : 'sesiones'} esta semana`
              : 'Sin sesiones esta semana'}
          </div>
        </div>
      </header>

      {/* ── Sesión abierta ── */}
      {live ? (
        <button className="live iron" onClick={() => setOpen(true)}>
          <div style={{ minWidth: 0 }}>
            <div className="live-title">{live.name}</div>
            <div className="live-time">
              En marcha · {workoutMinutes(live)} min · {totalSets(live)} {totalSets(live) === 1 ? 'serie' : 'series'}
            </div>
          </div>
          <span style={{ flex: '0 0 auto', display: 'grid' }}>
            <Icon name="chevron" size={20} />
          </span>
        </button>
      ) : (
        /* Sin rutinas guardadas no hay nada que elegir: una sola acción, y la
           sección de abajo ya explica qué es una rutina y deja crearla. */
        app.routines.length === 0 ? (
          <button className="btn primary" onClick={() => void start()}>Empezar un entreno</button>
        ) : (
          <div className="btns">
            <button className="btn primary" onClick={() => void start()}>Empezar vacío</button>
            <button className="btn" onClick={() => ui.open({ k: 'routine' })}>Rutinas</button>
          </div>
        )
      )}

      {/* ── Rutinas ── */}
      {app.routines.length > 0 && (
        <Section
          title="Tus rutinas"
          action={<button className="link" onClick={() => ui.open({ k: 'routine' })}>Editar</button>}
        >
          {/* Tarjeta por rutina: lo que lleva dentro se lee antes de empezarla,
              y el botón de empezar ocupa todo el ancho porque es lo que se va a
              tocar nueve de cada diez veces. */}
          <div className="routines">
            {[...app.routines]
              .sort((a, b) => b.useCount - a.useCount || b.createdAt - a.createdAt)
              .map((r) => (
                <div className="routine" key={r.id}>
                  <div className="routine-head">
                    <div style={{ minWidth: 0 }}>
                      <div className="routine-name">{r.name}</div>
                      <div className="row-meta">{describeRoutine(r)}</div>
                    </div>
                    <button
                      className="icon-btn"
                      aria-label={`Editar ${r.name}`}
                      onClick={() => ui.open({ k: 'routine', id: r.id })}
                    >
                      <Icon name="pen" size={17} />
                    </button>
                  </div>
                  <p className="routine-list">{listExercises(r, app.exercises)}</p>
                  <button className="btn primary" disabled={!!live} onClick={() => void start(r.id)}>
                    Empezar rutina
                  </button>
                </div>
              ))}
          </div>
        </Section>
      )}

      {app.routines.length === 0 && !live && (
        <Section title="Rutinas">
          <div className="empty">
            <strong>Aún no tienes rutinas</strong>
            Una rutina es una lista de ejercicios con sus series. Guardarla evita montar la sesión cada vez.
          </div>
          <button className="btn" onClick={() => ui.open({ k: 'routine' })}>Crear una rutina</button>
        </Section>
      )}

      {/* ── Resumen de la semana ── */}
      {thisWeek.count > 0 && (
        <Section title="Esta semana">
          <div className="iron-figures">
            <div>
              <div className="iron-label">Sesiones</div>
              <div className="iron-value">{thisWeek.count}</div>
            </div>
            <div>
              <div className="iron-label">Series</div>
              <div className="iron-value">{thisWeek.sets}</div>
            </div>
            <div>
              <div className="iron-label">Kilos movidos</div>
              <div className="iron-value">{g(thisWeek.volume)}</div>
            </div>
          </div>
        </Section>
      )}

      {/* ── Histórico ── */}
      <Section title="Historial" aside={app.workouts.length ? `${app.workouts.length} sesiones` : undefined}>
        {app.workouts.length === 0 ? (
          <div className="empty">
            <strong>Nada registrado todavía</strong>
            Empieza una sesión y marca las series según las hagas.
          </div>
        ) : (
          <div className="rows">
            {app.workouts.slice(0, 20).map((w) => {
              const muscles = musclesWorked(w);
              return (
                <button className="row" key={w.id} onClick={() => setDetail(w)}>
                  <div className="row-body">
                    <div className="row-name">{w.name}</div>
                    <div className="row-meta">
                      {formatDayLabel(w.date)} · {workoutMinutes(w)} min · {totalSets(w)} {totalSets(w) === 1 ? 'serie' : 'series'}
                      {muscles.length ? ` · ${muscles.slice(0, 2).map((m) => m.muscle).join(', ')}` : ''}
                    </div>
                  </div>
                  <div className="row-num">
                    {g(workoutVolume(w))}
                    <small>kg</small>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </Section>

      {/* ── Progreso por ejercicio ── */}
      {app.workouts.length > 0 && (
        <Section title="Tus ejercicios" aside="toca para ver la progresión">
          <div className="rows">
            {topExercises(app.workouts).map(({ exerciseId, name, sessions }) => (
              <button className="row" key={exerciseId} onClick={() => ui.open({ k: 'exercise', id: exerciseId })}>
                <div className="row-body">
                  <div className="row-name">{name}</div>
                  <div className="row-meta">
                    {MUSCLE_LABEL[EXERCISES_BY_ID.get(exerciseId)?.muscle ?? 'fullBody']} · {sessions}{' '}
                    {sessions === 1 ? 'sesión' : 'sesiones'}
                  </div>
                </div>
                <span style={{ color: 'var(--ink-3)', display: 'grid' }}><Icon name="chevron" size={16} /></span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {open && live && <ActiveWorkout workout={live} onClose={() => setOpen(false)} />}
    </div>
  );
}

function describeRoutine(r: Routine): string {
  const count = r.exercises.length;
  const sets = r.exercises.reduce((a, e) => a + e.sets, 0);
  const used = r.useCount > 0 ? ` · usada ${r.useCount} ${r.useCount === 1 ? 'vez' : 'veces'}` : '';
  return `${count} ${count === 1 ? 'ejercicio' : 'ejercicios'} · ${sets} series${used}`;
}

/**
 * Los ejercicios de una rutina, en una línea.
 *
 * Es lo que de verdad identifica una rutina: "Espalda/Bíceps" no dice nada,
 * "Jalón al pecho, Remo con barra, Curl…" sí.
 */
function listExercises(r: Routine, exercises: Exercise[]): string {
  const byId = new Map(exercises.map((e) => [e.id, e.name] as const));
  const names = r.exercises.map((re) => byId.get(re.exerciseId)).filter((n): n is string => !!n);
  return names.length ? names.join(', ') : 'Sin ejercicios todavía';
}

/** Ejercicios más registrados, para ofrecer su progresión. */
function topExercises(workouts: { exercises: { exerciseId: string; name: string }[] }[]) {
  const counts = new Map<string, { exerciseId: string; name: string; sessions: number }>();
  for (const w of workouts) {
    const seen = new Set<string>();
    for (const ex of w.exercises) {
      if (seen.has(ex.exerciseId)) continue;
      seen.add(ex.exerciseId);
      const row = counts.get(ex.exerciseId);
      if (row) row.sessions += 1;
      else counts.set(ex.exerciseId, { exerciseId: ex.exerciseId, name: ex.name, sessions: 1 });
    }
  }
  return [...counts.values()].sort((a, b) => b.sessions - a.sessions).slice(0, 8);
}
