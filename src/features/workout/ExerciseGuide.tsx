import { EQUIPMENT_LABEL, MUSCLE_LABEL } from '../../data/exercises';
import { TECHNIQUE, WITH_PHOTOS } from '../../data/technique';
import type { Exercise } from '../../domain/types';
import { describeSet, estimated1RM, personalBest } from '../../domain/workout';
import { Sheet } from '../../ui/components';
import { useApp } from '../store';

/** Ruta de las fotos, servidas desde la propia app para que funcionen sin red. */
export function photoUrl(exerciseId: string, index: 0 | 1): string | null {
  if (!WITH_PHOTOS.has(exerciseId)) return null;
  return `${import.meta.env.BASE_URL}ex/${exerciseId}-${index}.webp`;
}

/**
 * Cómo se hace un ejercicio.
 *
 * Dos fotos —posición de inicio y de final— y las claves que cambian el
 * resultado. Si del ejercicio no hay foto fiable se dice, en vez de enseñar la
 * de otro parecido.
 */
export function ExerciseGuide({ exercise, onClose }: { exercise: Exercise; onClose: () => void }) {
  const app = useApp();
  const t = TECHNIQUE[exercise.id];
  const start = photoUrl(exercise.id, 0);
  const end = photoUrl(exercise.id, 1);
  const pb = personalBest(exercise.id, app.workouts);

  return (
    <Sheet
      title={exercise.name}
      subtitle={`${MUSCLE_LABEL[exercise.muscle]} · ${EQUIPMENT_LABEL[exercise.equipment]}`}
      onClose={onClose}
      accent="iron"
    >
      {start && end ? (
        <div className="guide-photos">
          <figure>
            <img src={start} alt={`${exercise.name}: posición de inicio`} loading="lazy" />
            <figcaption>Inicio</figcaption>
          </figure>
          <figure>
            <img src={end} alt={`${exercise.name}: posición final`} loading="lazy" />
            <figcaption>Final</figcaption>
          </figure>
        </div>
      ) : (
        <p className="note">
          De este ejercicio no hay una foto fiable en la base de imágenes, así que no se enseña ninguna:
          poner la de un ejercicio parecido confunde más que ayuda.
        </p>
      )}

      {t && (
        <ol className="cues">
          {t.cues.map((c, i) => <li key={i}>{c}</li>)}
        </ol>
      )}

      {t?.error && (
        <div className="watch-out">
          <span className="watch-out-label">El fallo típico</span>
          {t.error}
        </div>
      )}

      <div className="guide-facts">
        <div className="fact">
          <span className="fact-label">Descanso sugerido</span>
          <span className="fact-value">{exercise.rest > 0 ? `${Math.round(exercise.rest / 60)} min` : 'continuo'}</span>
        </div>
        <div className="fact">
          <span className="fact-label">Tu récord</span>
          <span className="fact-value">
            {pb ? describeSet(pb.set, exercise.kind) : 'aún ninguno'}
          </span>
        </div>
        {pb && estimated1RM(pb.set) != null && (
          <div className="fact">
            <span className="fact-label">1RM estimada</span>
            <span className="fact-value">{estimated1RM(pb.set)} kg</span>
          </div>
        )}
      </div>

      {exercise.secondary.length > 0 && (
        <p className="note tight">
          También trabaja {exercise.secondary.map((m) => MUSCLE_LABEL[m].toLowerCase()).join(', ')}.
        </p>
      )}
    </Sheet>
  );
}
