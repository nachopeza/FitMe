import { useEffect, useMemo, useState } from 'react';
import { EXERCISES_BY_ID, MUSCLE_LABEL } from '../../data/exercises';
import type { Exercise, Workout, WorkoutExercise, WorkoutSet } from '../../domain/types';
import {
  averageRest, describeSet, estimated1RM, formatSeconds, nextSetTemplate, previousPerformance,
  totalSets, workingSets, workoutMinutes, workoutVolume,
} from '../../domain/workout';
import { Sheet, g } from '../../ui/components';
import { Icon } from '../../ui/icons';
import { useUI } from '../../ui/shell';
import { useApp } from '../store';
import { photoUrl } from './ExerciseGuide';
import { ExercisePicker } from './ExercisePicker';
import { RestTimer } from './RestTimer';

/**
 * Sesión de entrenamiento en marcha.
 *
 * Cada cambio se guarda al momento en la base de datos: cerrar la app a mitad de
 * una serie no pierde nada, que es lo mínimo exigible cuando se usa en el
 * gimnasio con una mano y la pantalla apagándose.
 *
 * El descanso arranca solo al marcar una serie, porque marcarla es justo el
 * gesto que indica que acaba de terminar.
 */
export function ActiveWorkout({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const app = useApp();
  const ui = useUI();
  const [picking, setPicking] = useState(false);
  const [rest, setRest] = useState<{ endsAt: number; total: number } | null>(null);
  const [confirmFinish, setConfirmFinish] = useState(false);
  const [elapsed, setElapsed] = useState(() => Date.now());

  useEffect(() => {
    const id = window.setInterval(() => setElapsed(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, []);

  // La misma cuenta que se guardará con la sesión, para que el resumen que se
  // confirma y el historial no digan dos números distintos.
  const minutes = workoutMinutes(workout, elapsed);
  /** Cronómetro de la sesión, con segundos: es lo que se mira en el gimnasio. */
  const clock = formatSeconds(Math.max(0, Math.round((elapsed - workout.startedAt) / 1000)));
  const rested = averageRest(workout);
  const sets = totalSets(workout);
  const volume = workoutVolume(workout);

  /** Toda modificación pasa por aquí y se persiste de inmediato. */
  const patch = (next: Workout) => {
    void app.actions.saveWorkout(next);
  };

  const patchExercise = (uid: string, fn: (ex: WorkoutExercise) => WorkoutExercise) => {
    patch({ ...workout, exercises: workout.exercises.map((ex) => (ex.uid === uid ? fn(ex) : ex)) });
  };

  const addExercise = (exercise: Exercise) => {
    const uid = `${workout.id}-${workout.exercises.length}-${Date.now().toString(36)}`;
    patch({
      ...workout,
      exercises: [
        ...workout.exercises,
        { uid, exerciseId: exercise.id, name: exercise.name, restSeconds: exercise.rest || 120, sets: [{ done: false }] },
      ],
    });
    setPicking(false);
  };

  const toggleSet = (ex: WorkoutExercise, index: number) => {
    const set = ex.sets[index];
    const nowDone = !set.done;
    patchExercise(ex.uid, (e) => ({
      ...e,
      // Se guarda la hora de marcado: de ahí sale el descanso real de la sesión.
      sets: e.sets.map((s, i) => (
        i === index ? { ...s, done: nowDone, completedAt: nowDone ? Date.now() : undefined } : s
      )),
    }));
    // Marcar una serie es la señal de que ha terminado: empieza el descanso.
    if (nowDone && ex.restSeconds > 0) {
      setRest({ endsAt: Date.now() + ex.restSeconds * 1000, total: ex.restSeconds });
    }
  };

  const finish = async () => {
    if (sets === 0) {
      // Una sesión sin ninguna serie marcada no es una sesión: se descarta.
      await app.actions.discardWorkout(workout.id);
      ui.notify('Sesión descartada, no tenía series marcadas.');
      onClose();
      return;
    }
    await app.actions.finishWorkout(workout);
    ui.notify(`Sesión guardada · ${sets} ${sets === 1 ? 'serie' : 'series'} · ${g(volume)} kg de volumen`);
    onClose();
  };

  if (picking) {
    return <ExercisePicker onPick={addExercise} onClose={() => setPicking(false)} />;
  }

  if (confirmFinish) {
    return (
      <Sheet
        title="¿Terminar la sesión?"
        onClose={() => setConfirmFinish(false)}
        footer={
          <>
            <button className="btn primary" onClick={() => void finish()}>Terminar y guardar</button>
            <button className="btn quiet sm" style={{ marginTop: 8 }} onClick={() => setConfirmFinish(false)}>
              Seguir entrenando
            </button>
          </>
        }
      >
        <div className="figures" style={{ marginBottom: 16 }}>
          <div className="figure">
            <div className="figure-label">Duración</div>
            <div className="figure-value">{minutes} min</div>
          </div>
          <div className="figure">
            <div className="figure-label">Series</div>
            <div className="figure-value">{sets}</div>
          </div>
          <div className="figure">
            <div className="figure-label">Volumen</div>
            <div className="figure-value">{g(volume)}<span style={{ fontSize: '0.6em' }}> kg</span></div>
          </div>
        </div>
        <p className="note">
          Al guardarla, el día queda marcado como día de entrenamiento y los objetivos de comida se ajustan a lo
          que ha costado la sesión.
        </p>
        <button className="btn danger sm" style={{ marginTop: 14 }} onClick={async () => {
          await app.actions.discardWorkout(workout.id);
          ui.notify('Sesión descartada.');
          onClose();
        }}>
          Descartar la sesión
        </button>
      </Sheet>
    );
  }

  return (
    <>
      <Sheet
        title={workout.name}
        subtitle={undefined}
        accent="iron"
        onClose={onClose}
        footer={
          <div className="btns">
            <button className="btn" onClick={() => setPicking(true)}>Añadir ejercicio</button>
            <button className="btn primary" onClick={() => setConfirmFinish(true)}>Terminar</button>
          </div>
        }
      >
        {/* Los cronómetros, lo primero: es lo que se mira entre serie y serie. */}
        <div className="clocks">
          <div className="clock-main">
            <span className="clock-label">En marcha</span>
            <span className="clock-time">{clock}</span>
          </div>
          <div className="clock-side">
            <div>
              <span className="clock-label">Series</span>
              <span className="clock-value">{sets}</span>
            </div>
            <div>
              <span className="clock-label">Kilos</span>
              <span className="clock-value">{g(volume)}</span>
            </div>
            <div>
              <span className="clock-label">Descanso medio</span>
              <span className="clock-value">{rested != null ? formatSeconds(rested) : '—'}</span>
            </div>
          </div>
        </div>

        {workout.exercises.length === 0 ? (
          <div className="empty">
            <strong>Sesión vacía</strong>
            Añade el primer ejercicio y empieza a marcar series.
          </div>
        ) : (
          workout.exercises.map((ex) => (
            <ExerciseBlock
              key={ex.uid}
              ex={ex}
              workoutId={workout.id}
              onToggleSet={(i) => toggleSet(ex, i)}
              onPatch={(fn) => patchExercise(ex.uid, fn)}
              onRemove={() => patch({ ...workout, exercises: workout.exercises.filter((e) => e.uid !== ex.uid) })}
            />
          ))
        )}
      </Sheet>

      {rest && (
        <RestTimer
          endsAt={rest.endsAt}
          total={rest.total}
          onDismiss={() => setRest(null)}
          onAdd={(s) => setRest((r) => {
            if (!r) return r;
            // Restar no puede dejar el descanso en negativo ni la barra sin
            // referencia: el suelo es ahora mismo y un total de 15 s.
            const endsAt = Math.max(Date.now(), r.endsAt + s * 1000);
            return { endsAt, total: Math.max(15, r.total + s) };
          })}
        />
      )}
    </>
  );
}

/** Un ejercicio dentro de la sesión, con su tabla de series. */
function ExerciseBlock({
  ex, workoutId, onToggleSet, onPatch, onRemove,
}: {
  ex: WorkoutExercise;
  workoutId: string;
  onToggleSet: (index: number) => void;
  onPatch: (fn: (ex: WorkoutExercise) => WorkoutExercise) => void;
  onRemove: () => void;
}) {
  const app = useApp();
  const def = EXERCISES_BY_ID.get(ex.exerciseId) ?? app.exercises.find((e) => e.id === ex.exerciseId);
  const kind = def?.kind ?? 'weightReps';
  const thumb = photoUrl(ex.exerciseId, 0);
  const [editingRest, setEditingRest] = useState(false);
  const [editingNote, setEditingNote] = useState(false);

  const previous = useMemo(
    () => previousPerformance(ex.exerciseId, app.workouts, workoutId),
    [ex.exerciseId, app.workouts, workoutId],
  );

  const setField = (index: number, field: keyof WorkoutSet, raw: string) => {
    const value = raw.trim() === '' ? undefined : Number(raw.replace(',', '.'));
    if (raw.trim() !== '' && !Number.isFinite(value)) return;
    onPatch((e) => ({ ...e, sets: e.sets.map((s, i) => (i === index ? { ...s, [field]: value } : s)) }));
  };

  const addSet = () => onPatch((e) => ({ ...e, sets: [...e.sets, nextSetTemplate(e)] }));
  const removeSet = (index: number) =>
    onPatch((e) => ({ ...e, sets: e.sets.filter((_, i) => i !== index) }));

  const showsWeight = kind === 'weightReps' || kind === 'weightedBodyweight';
  const showsReps = kind !== 'time' && kind !== 'distance';
  const showsTime = kind === 'time' || kind === 'distance';
  const showsDistance = kind === 'distance';

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 10 }}>
        {thumb && <img className="ex-thumb" src={thumb} alt="" loading="lazy" />}
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: 'var(--display)', fontWeight: 650, letterSpacing: '-0.015em' }}>{ex.name}</div>
          <div className="row-meta">{def ? MUSCLE_LABEL[def.muscle] : 'Ejercicio'}</div>
        </div>
        <button className="icon-btn" aria-label={`Quitar ${ex.name}`} onClick={onRemove}>
          <Icon name="trash" size={17} />
        </button>
      </div>

      {/* El descanso de ESTE ejercicio, a la vista y tocable: cambiarlo a mitad
          de sesión es normal y antes había que ir a la rutina. */}
      <div className="ex-chips">
        <button className="ex-chip" onClick={() => setEditingRest((v) => !v)} aria-expanded={editingRest}>
          <Icon name="timer" size={15} />
          Descanso: {ex.restSeconds > 0 ? formatSeconds(ex.restSeconds) : 'ninguno'}
        </button>
        <button className="ex-chip" onClick={() => setEditingNote((v) => !v)} aria-expanded={editingNote}>
          <Icon name="pen" size={15} />
          {ex.note ? 'Nota' : 'Añadir nota'}
        </button>
      </div>

      {editingRest && (
        <div className="rest-picker">
          {[0, 60, 90, 120, 150, 180, 240].map((sec) => (
            <button
              key={sec}
              className="chip"
              aria-pressed={ex.restSeconds === sec}
              onClick={() => { onPatch((e) => ({ ...e, restSeconds: sec })); setEditingRest(false); }}
            >
              {sec === 0 ? 'Sin descanso' : formatSeconds(sec)}
            </button>
          ))}
        </div>
      )}

      {editingNote && (
        <textarea
          className="input ex-note"
          rows={2}
          value={ex.note ?? ''}
          aria-label={`Nota de ${ex.name}`}
          placeholder="Sensaciones, agarre, altura del banco…"
          onChange={(e) => onPatch((prev) => ({ ...prev, note: e.target.value || undefined }))}
        />
      )}
      {!editingNote && ex.note && <p className="note tight ex-note-read">{ex.note}</p>}

      {previous && (
        <div className="note tight" style={{ marginBottom: 8 }}>
          La última vez: {workingSets(previous).map((s) => describeSet(s, kind)).join(' · ') || '—'}
        </div>
      )}

      <table className="sets">
        <thead>
          <tr>
            <th aria-label="Número de serie" />
            {previous && <th>Anterior</th>}
            {showsWeight && <th>kg</th>}
            {showsReps && <th>Reps</th>}
            {showsTime && <th>Tiempo (s)</th>}
            {showsDistance && <th>km</th>}
            <th aria-label="Hecha" />
          </tr>
        </thead>
        <tbody>
          {ex.sets.map((set, i) => {
            const prevSet = previous ? workingSets(previous)[i] : undefined;
            return (
              <tr key={i} className={set.done ? 'done' : undefined}>
                <td>
                  <button
                    className="set-n"
                    style={{ background: 'none', border: 0, width: '100%' }}
                    onClick={() => onPatch((e) => ({
                      ...e,
                      sets: e.sets.map((s, j) => (j === i ? { ...s, warmup: !s.warmup } : s)),
                    }))}
                    aria-label={set.warmup ? `Serie ${i + 1}, de calentamiento` : `Serie ${i + 1}`}
                    title="Marcar como calentamiento"
                  >
                    {set.warmup ? 'C' : i + 1}
                  </button>
                </td>
                {previous && <td className="set-prev">{prevSet ? describeSet(prevSet, kind) : '—'}</td>}
                {showsWeight && (
                  <td>
                    <input className="set-input" inputMode="decimal" value={set.kg ?? ''}
                      placeholder={prevSet?.kg != null ? String(prevSet.kg) : '0'}
                      aria-label={`Peso de la serie ${i + 1}`}
                      onChange={(e) => setField(i, 'kg', e.target.value)} />
                  </td>
                )}
                {showsReps && (
                  <td>
                    <input className="set-input" inputMode="numeric" value={set.reps ?? ''}
                      placeholder={prevSet?.reps != null ? String(prevSet.reps) : '0'}
                      aria-label={`Repeticiones de la serie ${i + 1}`}
                      onChange={(e) => setField(i, 'reps', e.target.value)} />
                  </td>
                )}
                {showsTime && (
                  <td>
                    <input className="set-input" inputMode="numeric" value={set.seconds ?? ''} placeholder="0"
                      aria-label={`Segundos de la serie ${i + 1}`}
                      onChange={(e) => setField(i, 'seconds', e.target.value)} />
                  </td>
                )}
                {showsDistance && (
                  <td>
                    <input className="set-input" inputMode="decimal" value={set.km ?? ''} placeholder="0"
                      aria-label={`Kilómetros de la serie ${i + 1}`}
                      onChange={(e) => setField(i, 'km', e.target.value)} />
                  </td>
                )}
                <td>
                  <button className="set-check" aria-pressed={set.done} aria-label={`Marcar serie ${i + 1}`}
                    onClick={() => onToggleSet(i)}>
                    <Icon name="check" size={16} />
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

      <div className="btns" style={{ marginTop: 10 }}>
        <button className="btn quiet sm" onClick={addSet}>+ Serie</button>
        <button className="btn quiet sm" disabled={ex.sets.length <= 1}
          onClick={() => removeSet(ex.sets.length - 1)}>
          Quitar serie
        </button>
      </div>

      {(() => {
        const top = workingSets(ex).map((s) => estimated1RM(s)).filter((x): x is number => x != null);
        if (!top.length) return null;
        return (
          <p className="note tight" style={{ marginTop: 10, marginBottom: 0 }}>
            Mejor serie de hoy: equivale a unos {Math.max(...top)} kg a una repetición.
          </p>
        );
      })()}
    </div>
  );
}
