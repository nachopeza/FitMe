import { EXERCISES_BY_ID, MUSCLE_LABEL } from '../../data/exercises';
import { formatDayLabel } from '../../domain/dates';
import type { Workout } from '../../domain/types';
import {
  averageRest, bestSet, describeSet, estimated1RM, exerciseVolume, muscleSets,
  musclesWorked, personalBest, totalReps, totalSets, workingSets, workoutMinutes, workoutVolume,
} from '../../domain/workout';
import { formatSeconds } from '../../domain/workout';
import { BodyMap } from '../../ui/BodyMap';
import { Sheet, g } from '../../ui/components';
import { useApp } from '../store';
import { photoUrl } from './ExerciseGuide';

/**
 * Lo que trabajaste en una sesión.
 *
 * El historial decía cuánto duró y poco más. Aquí está el detalle: qué músculos
 * y cuántas series a cada uno, serie a serie lo levantado, y si alguna fue tu
 * mejor marca. Es lo que convierte el registro en algo que se consulta.
 */
export function WorkoutDetail({ workout, onClose }: { workout: Workout; onClose: () => void }) {
  const app = useApp();
  const muscles = musclesWorked(workout);
  const sets = totalSets(workout);
  const volume = workoutVolume(workout);
  const rest = averageRest(workout);
  const maxSets = Math.max(1, ...muscles.map((m) => m.sets));

  // Las sesiones anteriores, para saber si una serie de hoy fue récord.
  const previous = app.workouts.filter((w) => w.id !== workout.id && w.finishedAt);

  return (
    <Sheet
      title={workout.name}
      subtitle={`${formatDayLabel(workout.date)} · ${workoutMinutes(workout)} min`}
      accent="iron"
      onClose={onClose}
    >
      <div className="iron-figures" style={{ marginBottom: 18 }}>
        <div>
          <div className="iron-label">Series</div>
          <div className="iron-value">{sets}</div>
        </div>
        <div>
          <div className="iron-label">Repeticiones</div>
          <div className="iron-value">{totalReps(workout)}</div>
        </div>
        <div>
          <div className="iron-label">Kilos movidos</div>
          <div className="iron-value">{g(volume)}</div>
        </div>
      </div>

      {rest != null && (
        <p className="note tight" style={{ marginTop: -6 }}>
          Descansaste <b>{formatSeconds(rest)}</b> de media entre series.
        </p>
      )}

      {muscles.length > 0 && (
        <div className="field">
          <span className="field-label">Qué trabajaste</span>
          <BodyMap worked={muscleSets([workout])} />
          <div className="muscles" style={{ marginTop: 14 }}>
            {muscles.map((m) => (
              <div className="muscle" key={m.muscle}>
                <span className="muscle-name">{m.muscle}</span>
                <span className="muscle-bar">
                  <span style={{ width: `${(m.sets / maxSets) * 100}%` }} />
                </span>
                <span className="muscle-sets">{m.sets}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="field">
        <span className="field-label">Ejercicio por ejercicio</span>
        {workout.exercises.map((ex) => {
          const done = workingSets(ex);
          if (!done.length) return null;
          const def = EXERCISES_BY_ID.get(ex.exerciseId);
          const kind = def?.kind ?? 'weightReps';
          const top = bestSet(ex);
          const pb = personalBest(ex.exerciseId, previous);
          const topScore = top ? estimated1RM(top) ?? (top.kg ?? 0) * (top.reps ?? 0) : 0;
          const pbScore = pb ? estimated1RM(pb.set) ?? (pb.set.kg ?? 0) * (pb.set.reps ?? 0) : 0;
          const isRecord = top != null && topScore > pbScore;
          const thumb = photoUrl(ex.exerciseId, 0);

          return (
            <div className="done-ex" key={ex.uid}>
              <div className="done-head">
                {thumb && <img className="ex-thumb" src={thumb} alt="" loading="lazy" />}
                <div style={{ minWidth: 0, flex: '1 1 auto' }}>
                  <div className="row-name">{ex.name}</div>
                  <div className="row-meta">
                    {done.length} {done.length === 1 ? 'serie' : 'series'}
                    {def ? ` · ${MUSCLE_LABEL[def.muscle]}` : ''}
                    {exerciseVolume(ex) > 0 ? ` · ${g(exerciseVolume(ex))} kg` : ''}
                  </div>
                </div>
                {isRecord && <span className="tag record">Récord</span>}
              </div>
              <div className="done-sets">
                {done.map((set, i) => (
                  <span className="done-set" key={i}>
                    <b>{i + 1}</b>{describeSet(set, kind)}
                  </span>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {workout.note && <p className="note">{workout.note}</p>}
    </Sheet>
  );
}
