import { useMemo, useState } from 'react';
import { EQUIPMENT_LABEL, MUSCLE_LABEL, MUSCLE_ORDER } from '../../data/exercises';
import { normalize } from '../../domain/parser';
import type { Exercise, MuscleGroup } from '../../domain/types';
import { Sheet } from '../../ui/components';
import { Icon } from '../../ui/icons';
import { useApp } from '../store';
import { ExerciseGuide, photoUrl } from './ExerciseGuide';

/**
 * Buscador de ejercicios.
 *
 * Filtra por grupo muscular y por texto, con alias: "banca" encuentra el press
 * de banca y "bench" también, porque cada cual los llama de una forma.
 */
export function ExercisePicker({
  onPick, onClose, title = 'Añadir ejercicio',
}: {
  onPick: (exercise: Exercise) => void;
  onClose: () => void;
  title?: string;
}) {
  const app = useApp();
  const [query, setQuery] = useState('');
  const [muscle, setMuscle] = useState<MuscleGroup | 'all'>('all');
  const [guide, setGuide] = useState<Exercise | null>(null);

  const results = useMemo(() => {
    const q = normalize(query);
    const list = app.exercises.filter((e) => {
      if (muscle !== 'all' && e.muscle !== muscle) return false;
      if (!q) return true;
      return [e.name, ...e.aliases].some((a) => normalize(a).includes(q));
    });
    // Agrupados por músculo, en el orden en que se piensan.
    return list.sort((a, b) => {
      const d = MUSCLE_ORDER.indexOf(a.muscle) - MUSCLE_ORDER.indexOf(b.muscle);
      return d !== 0 ? d : a.name.localeCompare(b.name, 'es');
    });
  }, [app.exercises, query, muscle]);

  if (guide) return <ExerciseGuide exercise={guide} onClose={() => setGuide(null)} />;

  return (
    <Sheet title={title} subtitle={`${app.exercises.length} ejercicios`} onClose={onClose}>
      <input
        className="input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar: banca, dominadas, sentadilla…"
        aria-label="Buscar ejercicio"
        autoFocus
      />

      <div className="chips" style={{ marginTop: 12 }}>
        <button className="chip" aria-pressed={muscle === 'all'} onClick={() => setMuscle('all')}>Todos</button>
        {MUSCLE_ORDER.map((m) => (
          <button key={m} className="chip" aria-pressed={muscle === m} onClick={() => setMuscle(m)}>
            {MUSCLE_LABEL[m]}
          </button>
        ))}
      </div>

      <div className="rows" style={{ marginTop: 16 }}>
        {results.map((e) => {
          const thumb = photoUrl(e.id, 0);
          return (
            <div className="row" key={e.id}>
              {/* La foto se toca para ver cómo se hace; el nombre, para añadirlo.
                  Son dos intenciones distintas y conviene no mezclarlas. */}
              <button
                className="thumb-btn"
                onClick={() => setGuide(e)}
                aria-label={`Cómo se hace ${e.name}`}
              >
                {thumb ? (
                  <img className="ex-thumb" src={thumb} alt="" loading="lazy" />
                ) : (
                  <span className="ex-thumb empty-thumb"><Icon name="dumbbell" size={20} /></span>
                )}
              </button>
              <button className="row-body" onClick={() => onPick(e)}>
                <div className="row-name">{e.name}</div>
                <div className="row-meta">
                  {MUSCLE_LABEL[e.muscle]} · {EQUIPMENT_LABEL[e.equipment]}
                  {e.rest > 0 ? ` · ${Math.round(e.rest / 60)} min` : ' · continuo'}
                </div>
              </button>
            </div>
          );
        })}
      </div>

      {results.length === 0 && (
        <div className="empty">
          <strong>No hay nada con ese nombre</strong>
          Prueba con otra palabra o quita el filtro de músculo.
        </div>
      )}
    </Sheet>
  );
}
