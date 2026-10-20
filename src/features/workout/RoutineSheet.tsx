import { useMemo, useState } from 'react';
import { EXERCISES_BY_ID, MUSCLE_LABEL } from '../../data/exercises';
import { formatDayLabel } from '../../domain/dates';
import type { Exercise, Routine, RoutineExercise } from '../../domain/types';
import {
  bestSet, describeSet, estimated1RM, personalBest, totalSets, workingSets, workoutVolume,
} from '../../domain/workout';
import { Figure, NumberInput, Section, Sheet, g } from '../../ui/components';
import { Icon } from '../../ui/icons';
import { useUI } from '../../ui/shell';
import { useApp } from '../store';
import { ExercisePicker } from './ExercisePicker';

/** Lista de rutinas y su edición. */
export function RoutineSheet({ id, onClose }: { id?: string; onClose: () => void }) {
  const app = useApp();
  const [editing, setEditing] = useState<Routine | null>(
    id ? app.routines.find((r) => r.id === id) ?? null : null,
  );

  if (editing) return <RoutineEditor routine={editing} onClose={() => setEditing(null)} onDone={onClose} />;

  return (
    <Sheet
      title="Rutinas"
      subtitle="Listas de ejercicios que repites"
      onClose={onClose}
      footer={<button className="btn primary" onClick={() => setEditing(emptyRoutine())}>Nueva rutina</button>}
    >
      {app.routines.length === 0 ? (
        <div className="empty">
          <strong>Ninguna rutina todavía</strong>
          Crea una con los ejercicios de tu día de pecho, por ejemplo, y empezar la sesión será un toque.
        </div>
      ) : (
        <div className="rows">
          {[...app.routines]
            .sort((a, b) => b.useCount - a.useCount)
            .map((r) => (
              <div className="row" key={r.id}>
                <button className="row-body" style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }}
                  onClick={() => setEditing(r)}>
                  <div className="row-name">{r.name}</div>
                  <div className="row-meta">
                    {r.exercises.length} {r.exercises.length === 1 ? 'ejercicio' : 'ejercicios'} · {r.exercises.reduce((a, e) => a + e.sets, 0)} series
                  </div>
                </button>
                <button className="icon-btn" aria-label={`Borrar ${r.name}`}
                  onClick={() => void app.actions.deleteRoutine(r.id)}>
                  <Icon name="trash" size={17} />
                </button>
              </div>
            ))}
        </div>
      )}
    </Sheet>
  );
}

function emptyRoutine(): Routine {
  return { id: `r-${Date.now().toString(36)}`, name: '', exercises: [], useCount: 0, createdAt: Date.now() };
}

function RoutineEditor({
  routine, onClose, onDone,
}: { routine: Routine; onClose: () => void; onDone: () => void }) {
  const app = useApp();
  const ui = useUI();
  const [r, setR] = useState<Routine>(routine);
  const [picking, setPicking] = useState(false);

  const add = (exercise: Exercise) => {
    setR((prev) => ({
      ...prev,
      exercises: [...prev.exercises, { exerciseId: exercise.id, sets: 3, restSeconds: exercise.rest || 120 }],
    }));
    setPicking(false);
  };

  const patch = (index: number, change: Partial<RoutineExercise>) =>
    setR((prev) => ({
      ...prev,
      exercises: prev.exercises.map((e, i) => (i === index ? { ...e, ...change } : e)),
    }));

  const move = (index: number, delta: number) =>
    setR((prev) => {
      const next = [...prev.exercises];
      const target = index + delta;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return { ...prev, exercises: next };
    });

  if (picking) return <ExercisePicker onPick={add} onClose={() => setPicking(false)} />;

  return (
    <Sheet
      title={routine.name ? 'Editar rutina' : 'Nueva rutina'}
      onClose={onClose}
      footer={
        <div className="btns">
          <button className="btn quiet" onClick={onClose}>Cancelar</button>
          <button className="btn primary" disabled={r.name.trim().length < 2 || r.exercises.length === 0}
            onClick={async () => {
              await app.actions.upsertRoutine({ ...r, name: r.name.trim() });
              ui.notify('Rutina guardada.');
              onDone();
            }}>
            Guardar
          </button>
        </div>
      }
    >
      <div className="field">
        <span className="field-label">Nombre</span>
        <input className="input" value={r.name} onChange={(e) => setR({ ...r, name: e.target.value })}
          placeholder="Pecho y tríceps" aria-label="Nombre de la rutina" />
      </div>

      {r.exercises.map((re, i) => {
        const def = EXERCISES_BY_ID.get(re.exerciseId) ?? app.exercises.find((e) => e.id === re.exerciseId);
        return (
          <div className="card" key={`${re.exerciseId}-${i}`} style={{ marginBottom: 10 }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 10 }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600 }}>{def?.name ?? re.exerciseId}</div>
                <div className="row-meta">{def ? MUSCLE_LABEL[def.muscle] : ''}</div>
              </div>
              <button className="icon-btn" aria-label="Subir" disabled={i === 0} onClick={() => move(i, -1)}>
                <span style={{ transform: 'rotate(-90deg)', display: 'grid' }}><Icon name="chevron" size={15} /></span>
              </button>
              <button className="icon-btn" aria-label="Bajar" disabled={i === r.exercises.length - 1}
                onClick={() => move(i, 1)}>
                <span style={{ transform: 'rotate(90deg)', display: 'grid' }}><Icon name="chevron" size={15} /></span>
              </button>
              <button className="icon-btn" aria-label="Quitar"
                onClick={() => setR({ ...r, exercises: r.exercises.filter((_, j) => j !== i) })}>
                <Icon name="trash" size={16} />
              </button>
            </div>
            <div className="figures two">
              <div className="field" style={{ marginBottom: 0 }}>
                <span className="field-label">Series</span>
                <NumberInput value={re.sets} min={1} max={12} label="Series"
                  onChange={(v) => patch(i, { sets: v })} />
              </div>
              <div className="field" style={{ marginBottom: 0 }}>
                <span className="field-label">Descanso (s)</span>
                <NumberInput value={re.restSeconds} min={0} max={600} step={15} label="Descanso en segundos"
                  onChange={(v) => patch(i, { restSeconds: v })} />
              </div>
            </div>
          </div>
        );
      })}

      <button className="btn" onClick={() => setPicking(true)}>Añadir ejercicio</button>

      {r.exercises.length === 0 && (
        <p className="note tight" style={{ marginTop: 12 }}>
          Añade los ejercicios en el orden en que los haces. Después, empezar la sesión te los deja preparados.
        </p>
      )}
    </Sheet>
  );
}

/** Progresión de un ejercicio a lo largo de las sesiones. */
export function ExerciseHistorySheet({ id, onClose }: { id: string; onClose: () => void }) {
  const app = useApp();
  const def = EXERCISES_BY_ID.get(id) ?? app.exercises.find((e) => e.id === id);

  const sessions = useMemo(
    () =>
      app.workouts
        .map((w) => ({ workout: w, ex: w.exercises.find((e) => e.exerciseId === id) }))
        .filter((x): x is { workout: typeof app.workouts[number]; ex: NonNullable<typeof x.ex> } => !!x.ex)
        .filter((x) => workingSets(x.ex).length > 0),
    [app.workouts, id],
  );

  const pb = useMemo(() => personalBest(id, app.workouts), [id, app.workouts]);

  if (!def) return <Sheet title="Ejercicio" onClose={onClose}><p className="note">No encontrado.</p></Sheet>;

  return (
    <Sheet title={def.name} subtitle={MUSCLE_LABEL[def.muscle]} onClose={onClose}>
      {pb && (
        <div className="figures" style={{ marginBottom: 8 }}>
          <Figure label="Mejor serie" value={describeSet(pb.set, def.kind)} text />
          <Figure label="Equivale a" value={estimated1RM(pb.set) ? `${estimated1RM(pb.set)} kg` : '—'} sub="a 1 repetición" />
          <Figure label="Cuándo" value={formatDayLabel(pb.date)} text />
        </div>
      )}

      <Section title="Sesión a sesión" aside={`${sessions.length}`}>
        {sessions.length === 0 ? (
          <div className="empty">Todavía no has registrado series de este ejercicio.</div>
        ) : (
          <div className="rows">
            {sessions.map(({ workout, ex }) => {
              const top = bestSet(ex);
              return (
                <div className="row" key={workout.id}>
                  <div className="row-body">
                    <div className="row-name">{formatDayLabel(workout.date)}</div>
                    <div className="row-meta">
                      {workingSets(ex).map((s) => describeSet(s, def.kind)).join(' · ')}
                    </div>
                  </div>
                  <div className="row-num">
                    {top ? describeSet(top, def.kind) : '—'}
                    <small>mejor</small>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Section>

      <p className="note tight" style={{ marginTop: 18 }}>
        Las series de calentamiento no cuentan aquí: marcándolas con la «C» quedan fuera del volumen y de los
        récords, que es lo que permite comparar sesiones entre sí.
      </p>
      {sessions.length > 0 && (
        <p className="note tight">
          Volumen de la última sesión: {g(workoutVolume(sessions[0].workout))} kg en {totalSets(sessions[0].workout)} series.
        </p>
      )}
    </Sheet>
  );
}
