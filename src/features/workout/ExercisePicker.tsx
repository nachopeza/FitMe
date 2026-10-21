import { useMemo, useState } from 'react';
import { EQUIPMENT_LABEL, MUSCLE_LABEL, MUSCLE_ORDER } from '../../data/exercises';
import { normalize } from '../../domain/parser';
import type { Equipment, Exercise, MuscleGroup } from '../../domain/types';
import { Sheet } from '../../ui/components';
import { Icon } from '../../ui/icons';
import { useApp } from '../store';
import { ExerciseEditSheet } from './ExerciseEditSheet';
import { ExerciseGuide, photoUrl } from './ExerciseGuide';

/**
 * Buscador de ejercicios.
 *
 * La estructura es la de la referencia que pidió: crear arriba a la derecha,
 * buscador, dos filtros —con qué se hace y qué músculo—, los recientes primero
 * y luego el catálogo por grupos. Cada fila lleva su miniatura, el músculo
 * debajo del nombre y la «i» de cómo se hace a la derecha.
 *
 * Los recientes van primero porque un entreno se repite: del casi centenar del
 * catálogo él usa los mismos doce, y tenerlos arriba ahorra el buscador entero.
 *
 * Filtra por texto con alias: "banca" encuentra el press de banca y "bench"
 * también, porque cada cual los llama de una forma.
 */
const EQUIPMENT_ORDER: Equipment[] = [
  'machine', 'dumbbell', 'barbell', 'cable', 'bodyweight', 'kettlebell', 'band', 'other',
];

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
  const [equipment, setEquipment] = useState<Equipment | 'all'>('all');
  /** Qué fila de filtros está desplegada: solo una, para no comerse la pantalla. */
  const [openFilter, setOpenFilter] = useState<'muscle' | 'equipment' | null>(null);
  const [guide, setGuide] = useState<Exercise | null>(null);
  const [creating, setCreating] = useState(false);

  /** Los que ha usado de verdad, del más reciente al más antiguo. */
  const recentIds = useMemo(() => {
    const seen = new Map<string, number>();
    for (const w of app.workouts) {
      for (const ex of w.exercises) {
        const when = w.finishedAt ?? w.startedAt;
        if ((seen.get(ex.exerciseId) ?? 0) < when) seen.set(ex.exerciseId, when);
      }
    }
    return [...seen.entries()].sort((a, b) => b[1] - a[1]).map(([id]) => id);
  }, [app.workouts]);

  const matches = useMemo(() => {
    const q = normalize(query);
    return app.exercises.filter((e) => {
      if (muscle !== 'all' && e.muscle !== muscle) return false;
      if (equipment !== 'all' && e.equipment !== equipment) return false;
      if (!q) return true;
      return [e.name, ...e.aliases].some((a) => normalize(a).includes(q));
    });
  }, [app.exercises, query, muscle, equipment]);

  /** Recientes arriba y el resto por grupo muscular, en el orden en que se piensan. */
  const groups = useMemo(() => {
    const byId = new Map(matches.map((e) => [e.id, e]));
    const recent = recentIds.map((id) => byId.get(id)).filter((e): e is Exercise => !!e);
    const recentSet = new Set(recent.map((e) => e.id));
    const rest = matches
      .filter((e) => !recentSet.has(e.id))
      .sort((a, b) => {
        const d = MUSCLE_ORDER.indexOf(a.muscle) - MUSCLE_ORDER.indexOf(b.muscle);
        return d !== 0 ? d : a.name.localeCompare(b.name, 'es');
      });
    const out: { key: string; label: string; items: Exercise[] }[] = [];
    if (recent.length) out.push({ key: 'recientes', label: 'Los que usas', items: recent.slice(0, 8) });
    let current: MuscleGroup | null = null;
    for (const e of rest) {
      if (e.muscle !== current) {
        current = e.muscle;
        out.push({ key: e.muscle, label: MUSCLE_LABEL[e.muscle], items: [] });
      }
      out[out.length - 1].items.push(e);
    }
    return out;
  }, [matches, recentIds]);

  if (guide) return <ExerciseGuide exercise={guide} onClose={() => setGuide(null)} />;
  if (creating) {
    return (
      <ExerciseEditSheet
        initialName={query}
        onClose={() => setCreating(false)}
        onDone={(e) => { setCreating(false); onPick(e); }}
      />
    );
  }

  const muscleLabel = muscle === 'all' ? 'Todos los músculos' : MUSCLE_LABEL[muscle];
  const equipmentLabel = equipment === 'all' ? 'Todo el material' : EQUIPMENT_LABEL[equipment];

  return (
    <Sheet
      title={title}
      subtitle={`${matches.length} de ${app.exercises.length}`}
      onClose={onClose}
      action={<button className="btn quiet sm" onClick={() => setCreating(true)}>Crear</button>}
    >
      <input
        className="input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar: banca, dominadas, sentadilla…"
        aria-label="Buscar ejercicio"
        autoFocus
      />

      {/* Dos filtros, uno desplegado como mucho. El texto del botón dice qué hay
          puesto, así que se ve el filtro activo sin abrirlo. */}
      <div className="filters">
        <button
          className={`filter${equipment !== 'all' ? ' on' : ''}`}
          aria-expanded={openFilter === 'equipment'}
          onClick={() => setOpenFilter((f) => (f === 'equipment' ? null : 'equipment'))}
        >
          <span>{equipmentLabel}</span>
          <Icon name="chevron" size={15} />
        </button>
        <button
          className={`filter${muscle !== 'all' ? ' on' : ''}`}
          aria-expanded={openFilter === 'muscle'}
          onClick={() => setOpenFilter((f) => (f === 'muscle' ? null : 'muscle'))}
        >
          <span>{muscleLabel}</span>
          <Icon name="chevron" size={15} />
        </button>
      </div>

      {openFilter === 'equipment' && (
        <div className="chips" role="group" aria-label="Filtrar por material">
          <button className="chip" aria-pressed={equipment === 'all'}
            onClick={() => { setEquipment('all'); setOpenFilter(null); }}>Todo</button>
          {EQUIPMENT_ORDER.map((eq) => (
            <button key={eq} className="chip" aria-pressed={equipment === eq}
              onClick={() => { setEquipment(eq); setOpenFilter(null); }}>
              {EQUIPMENT_LABEL[eq]}
            </button>
          ))}
        </div>
      )}
      {openFilter === 'muscle' && (
        <div className="chips" role="group" aria-label="Filtrar por músculo">
          <button className="chip" aria-pressed={muscle === 'all'}
            onClick={() => { setMuscle('all'); setOpenFilter(null); }}>Todos</button>
          {MUSCLE_ORDER.map((m) => (
            <button key={m} className="chip" aria-pressed={muscle === m}
              onClick={() => { setMuscle(m); setOpenFilter(null); }}>
              {MUSCLE_LABEL[m]}
            </button>
          ))}
        </div>
      )}

      {groups.map((grupo) => (
        <section className="ex-group" key={grupo.key}>
          <h3 className="ex-group-head">{grupo.label}</h3>
          <div className="ex-list">
            {grupo.items.map((e) => (
              <ExerciseRow key={e.id} exercise={e} onPick={onPick} onGuide={() => setGuide(e)} />
            ))}
          </div>
        </section>
      ))}

      {matches.length === 0 && (
        <div className="empty">
          <strong>No hay nada con ese nombre</strong>
          Quita un filtro, prueba con otra palabra, o créalo tú: se queda guardado en tu catálogo.
          <button className="btn primary" style={{ marginTop: 12 }} onClick={() => setCreating(true)}>
            Crear «{query.trim() || 'un ejercicio'}»
          </button>
        </div>
      )}
    </Sheet>
  );
}

/**
 * Una fila del catálogo.
 *
 * El nombre y la miniatura añaden; la «i» abre la técnica. Antes la foto era el
 * botón de la técnica, y nadie lo adivinaba: tocar la foto de algo que quieres
 * añadir es tocarlo para añadirlo.
 */
function ExerciseRow({
  exercise, onPick, onGuide,
}: {
  exercise: Exercise;
  onPick: (e: Exercise) => void;
  onGuide: () => void;
}) {
  const thumb = photoUrl(exercise.id, 0);
  return (
    <div className="ex-row">
      <button className="ex-row-body" onClick={() => onPick(exercise)}>
        {thumb ? (
          <img className="ex-round" src={thumb} alt="" loading="lazy" />
        ) : (
          <span className="ex-round empty-thumb"><Icon name="dumbbell" size={20} /></span>
        )}
        <span className="ex-row-text">
          <span className="ex-row-name">
            {exercise.name}
            {exercise.custom && <span className="ex-mine">tuyo</span>}
          </span>
          <span className="ex-row-muscle">
            {MUSCLE_LABEL[exercise.muscle]} · {EQUIPMENT_LABEL[exercise.equipment]}
          </span>
        </span>
      </button>
      <button className="ex-info" onClick={onGuide} aria-label={`Cómo se hace ${exercise.name}`}>
        i
      </button>
    </div>
  );
}
