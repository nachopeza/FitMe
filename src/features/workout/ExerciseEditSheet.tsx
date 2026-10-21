import { useState } from 'react';
import { EQUIPMENT_LABEL, MUSCLE_LABEL, MUSCLE_ORDER } from '../../data/exercises';
import type { Equipment, Exercise, ExerciseKind, MuscleGroup } from '../../domain/types';
import { Field, NumberInput, Sheet } from '../../ui/components';
import { useApp } from '../store';

/**
 * Crear un ejercicio propio.
 *
 * Faltaba: el catálogo trae casi cien, pero en cualquier gimnasio hay una
 * máquina rara que no está, y sin esto no había forma de anotarla. El mismo
 * agujero que tenían los productos del súper.
 *
 * Lo que se pregunta es lo mínimo con lo que la sesión sabe qué pedir: cómo se
 * llama, qué músculo trabaja, con qué se hace y cómo se mide. El descanso trae
 * un valor razonable para no dejarlo en blanco.
 */
const KIND_LABEL: Record<ExerciseKind, string> = {
  weightReps: 'Peso × repeticiones',
  bodyweightReps: 'Solo repeticiones',
  weightedBodyweight: 'Peso añadido × repeticiones',
  time: 'Tiempo',
  distance: 'Distancia y tiempo',
};

const EQUIPMENT_ORDER: Equipment[] = [
  'machine', 'dumbbell', 'barbell', 'cable', 'bodyweight', 'kettlebell', 'band', 'other',
];

export function ExerciseEditSheet({
  onDone, onClose, initialName = '',
}: {
  /** Se llama con el ejercicio ya guardado, para poder añadirlo de seguido. */
  onDone: (exercise: Exercise) => void;
  onClose: () => void;
  /** Lo que estuviera buscando cuando no lo encontró. */
  initialName?: string;
}) {
  const app = useApp();
  const [name, setName] = useState(initialName);
  const [muscle, setMuscle] = useState<MuscleGroup>('chest');
  const [equipment, setEquipment] = useState<Equipment>('machine');
  const [kind, setKind] = useState<ExerciseKind>('weightReps');
  const [rest, setRest] = useState<number | ''>(120);
  const [saving, setSaving] = useState(false);

  const clean = name.trim();
  const dup = clean
    ? app.exercises.find((e) => e.name.toLowerCase() === clean.toLowerCase())
    : undefined;

  const save = async () => {
    if (!clean || dup || saving) return;
    setSaving(true);
    const exercise: Exercise = {
      id: `mio-${Date.now().toString(36)}`,
      name: clean,
      aliases: [],
      muscle,
      secondary: [],
      equipment,
      kind,
      rest: typeof rest === 'number' ? Math.max(0, Math.round(rest)) : 120,
      custom: true,
    };
    await app.actions.upsertExercise(exercise);
    onDone(exercise);
  };

  return (
    <Sheet
      title="Nuevo ejercicio"
      subtitle="Se guarda en tu catálogo para siempre"
      onClose={onClose}
      footer={
        <button className="btn primary" disabled={!clean || !!dup || saving} onClick={() => void save()}>
          {saving ? 'Guardando…' : 'Guardar y añadir'}
        </button>
      }
    >
      <Field label="Nombre">
        <input
          id="ex-nombre"
          className="input"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Press inclinado en multipower"
          autoFocus
        />
      </Field>
      {dup && (
        <p className="note" style={{ color: 'var(--over)' }}>
          Ya tienes «{dup.name}». Búscalo en la lista en vez de crearlo otra vez.
        </p>
      )}

      <Field label="Músculo principal">
        <div className="chips">
          {MUSCLE_ORDER.map((m) => (
            <button key={m} className="chip" aria-pressed={muscle === m} onClick={() => setMuscle(m)}>
              {MUSCLE_LABEL[m]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Con qué se hace">
        <div className="chips">
          {EQUIPMENT_ORDER.map((eq) => (
            <button key={eq} className="chip" aria-pressed={equipment === eq} onClick={() => setEquipment(eq)}>
              {EQUIPMENT_LABEL[eq]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Cómo se mide">
        <div className="chips">
          {(Object.keys(KIND_LABEL) as ExerciseKind[]).map((k) => (
            <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
              {KIND_LABEL[k]}
            </button>
          ))}
        </div>
      </Field>

      <Field label="Descanso sugerido (segundos)">
        <NumberInput id="ex-descanso" value={rest} onChange={setRest} min={0} max={600} step={15} />
      </Field>
    </Sheet>
  );
}
