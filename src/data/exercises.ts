import type { Equipment, Exercise, ExerciseKind, MuscleGroup } from '../domain/types';

/**
 * Biblioteca de ejercicios.
 *
 * Nombres en español de gimnasio, con alias para buscarlos como cada cual los
 * llama ("press banca", "banca", "bench"). Cada uno trae su descanso sugerido:
 * los básicos pesados piden 3 minutos, el aislamiento 60-90 segundos.
 */

export const MUSCLE_LABEL: Record<MuscleGroup, string> = {
  chest: 'Pecho',
  back: 'Espalda',
  shoulders: 'Hombro',
  biceps: 'Bíceps',
  triceps: 'Tríceps',
  forearms: 'Antebrazo',
  quads: 'Cuádriceps',
  hamstrings: 'Femoral',
  glutes: 'Glúteo',
  calves: 'Gemelo',
  core: 'Core',
  fullBody: 'Cuerpo completo',
  cardio: 'Cardio',
};

export const EQUIPMENT_LABEL: Record<Equipment, string> = {
  barbell: 'Barra',
  dumbbell: 'Mancuerna',
  machine: 'Máquina',
  cable: 'Polea',
  bodyweight: 'Peso corporal',
  kettlebell: 'Kettlebell',
  band: 'Goma',
  other: 'Otro',
};

type Row = [
  id: string,
  name: string,
  muscle: MuscleGroup,
  equipment: Equipment,
  rest: number,
  kind?: ExerciseKind,
  secondary?: MuscleGroup[],
  aliases?: string[],
];

const ROWS: Row[] = [
  // ─────────────────────────────── Pecho ───────────────────────────────
  ['press-banca', 'Press de banca', 'chest', 'barbell', 180, 'weightReps', ['triceps', 'shoulders'], ['banca', 'bench press', 'press plano']],
  ['press-inclinado', 'Press inclinado con barra', 'chest', 'barbell', 180, 'weightReps', ['shoulders', 'triceps'], ['inclinado']],
  ['press-declinado', 'Press declinado con barra', 'chest', 'barbell', 180, 'weightReps', ['triceps']],
  ['press-banca-mancuernas', 'Press de banca con mancuernas', 'chest', 'dumbbell', 150, 'weightReps', ['triceps', 'shoulders'], ['press mancuernas']],
  ['press-inclinado-mancuernas', 'Press inclinado con mancuernas', 'chest', 'dumbbell', 150, 'weightReps', ['shoulders', 'triceps'], ['inclinado mancuernas']],
  ['aperturas-mancuerna', 'Aperturas con mancuernas', 'chest', 'dumbbell', 90, 'weightReps', [], ['aperturas', 'flyes']],
  ['aperturas-polea', 'Aperturas en polea', 'chest', 'cable', 90, 'weightReps', [], ['cruces de polea', 'crossover']],
  ['press-maquina-pecho', 'Press de pecho en máquina', 'chest', 'machine', 120, 'weightReps', ['triceps']],
  ['peck-deck', 'Contractor de pecho', 'chest', 'machine', 90, 'weightReps', [], ['peck deck', 'mariposa']],
  ['flexiones', 'Flexiones', 'chest', 'bodyweight', 90, 'bodyweightReps', ['triceps', 'core'], ['push ups', 'pushups']],
  ['flexiones-lastradas', 'Flexiones lastradas', 'chest', 'bodyweight', 120, 'weightedBodyweight', ['triceps']],
  ['fondos-pecho', 'Fondos en paralelas', 'chest', 'bodyweight', 150, 'weightedBodyweight', ['triceps', 'shoulders'], ['dips', 'fondos']],
  ['pullover', 'Pullover con mancuerna', 'chest', 'dumbbell', 120, 'weightReps', ['back']],

  // ─────────────────────────────── Espalda ───────────────────────────────
  ['dominadas', 'Dominadas', 'back', 'bodyweight', 180, 'weightedBodyweight', ['biceps'], ['pull ups', 'pullups']],
  ['dominadas-supinas', 'Dominadas supinas', 'back', 'bodyweight', 150, 'weightedBodyweight', ['biceps'], ['chin ups']],
  ['jalon-pecho', 'Jalón al pecho', 'back', 'cable', 120, 'weightReps', ['biceps'], ['jalon', 'lat pulldown', 'polea alta']],
  ['jalon-agarre-estrecho', 'Jalón con agarre estrecho', 'back', 'cable', 120, 'weightReps', ['biceps']],
  ['remo-barra', 'Remo con barra', 'back', 'barbell', 180, 'weightReps', ['biceps'], ['remo', 'barbell row']],
  ['remo-pendlay', 'Remo Pendlay', 'back', 'barbell', 180, 'weightReps', ['biceps']],
  ['remo-mancuerna', 'Remo con mancuerna', 'back', 'dumbbell', 120, 'weightReps', ['biceps'], ['remo a una mano']],
  ['remo-polea-baja', 'Remo en polea baja', 'back', 'cable', 120, 'weightReps', ['biceps'], ['remo sentado']],
  ['remo-maquina', 'Remo en máquina', 'back', 'machine', 120, 'weightReps', ['biceps']],
  ['remo-t', 'Remo en T', 'back', 'barbell', 150, 'weightReps', ['biceps'], ['t-bar']],
  ['peso-muerto', 'Peso muerto', 'back', 'barbell', 240, 'weightReps', ['hamstrings', 'glutes'], ['deadlift', 'muerto']],
  ['peso-muerto-rumano', 'Peso muerto rumano', 'hamstrings', 'barbell', 180, 'weightReps', ['glutes', 'back'], ['rumano', 'rdl']],
  ['pull-over-polea', 'Pullover en polea', 'back', 'cable', 90, 'weightReps', []],
  ['face-pull', 'Face pull', 'shoulders', 'cable', 90, 'weightReps', ['back'], ['facepull']],
  ['encogimientos', 'Encogimientos de trapecio', 'back', 'dumbbell', 90, 'weightReps', [], ['shrugs', 'trapecio']],
  ['hiperextensiones', 'Hiperextensiones', 'back', 'bodyweight', 90, 'weightedBodyweight', ['glutes', 'hamstrings'], ['lumbar', 'extensiones de espalda']],

  // ─────────────────────────────── Hombro ───────────────────────────────
  ['press-militar', 'Press militar con barra', 'shoulders', 'barbell', 180, 'weightReps', ['triceps'], ['militar', 'ohp', 'press hombro']],
  ['press-hombro-mancuernas', 'Press de hombro con mancuernas', 'shoulders', 'dumbbell', 150, 'weightReps', ['triceps']],
  ['press-arnold', 'Press Arnold', 'shoulders', 'dumbbell', 150, 'weightReps', ['triceps'], ['arnold']],
  ['press-hombro-maquina', 'Press de hombro en máquina', 'shoulders', 'machine', 120, 'weightReps', ['triceps']],
  ['elevaciones-laterales', 'Elevaciones laterales', 'shoulders', 'dumbbell', 75, 'weightReps', [], ['laterales']],
  ['elevaciones-laterales-polea', 'Elevaciones laterales en polea', 'shoulders', 'cable', 75, 'weightReps', []],
  ['elevaciones-frontales', 'Elevaciones frontales', 'shoulders', 'dumbbell', 75, 'weightReps', [], ['frontales']],
  ['pajaro', 'Pájaro', 'shoulders', 'dumbbell', 75, 'weightReps', ['back'], ['deltoides posterior', 'reverse fly']],
  ['pajaro-maquina', 'Pájaro en máquina', 'shoulders', 'machine', 75, 'weightReps', ['back']],
  ['remo-menton', 'Remo al mentón', 'shoulders', 'barbell', 120, 'weightReps', ['biceps'], ['upright row']],

  // ─────────────────────────────── Bíceps ───────────────────────────────
  ['curl-barra', 'Curl con barra', 'biceps', 'barbell', 90, 'weightReps', ['forearms'], ['curl']],
  ['curl-barra-z', 'Curl con barra Z', 'biceps', 'barbell', 90, 'weightReps', ['forearms'], ['barra z']],
  ['curl-mancuernas', 'Curl con mancuernas', 'biceps', 'dumbbell', 90, 'weightReps', ['forearms']],
  ['curl-alterno', 'Curl alterno', 'biceps', 'dumbbell', 90, 'weightReps', ['forearms']],
  ['curl-martillo', 'Curl martillo', 'biceps', 'dumbbell', 90, 'weightReps', ['forearms'], ['martillo', 'hammer curl']],
  ['curl-inclinado', 'Curl en banco inclinado', 'biceps', 'dumbbell', 90, 'weightReps', []],
  ['curl-concentrado', 'Curl concentrado', 'biceps', 'dumbbell', 75, 'weightReps', []],
  ['curl-predicador', 'Curl predicador', 'biceps', 'barbell', 90, 'weightReps', [], ['scott', 'predicador']],
  ['curl-polea', 'Curl en polea', 'biceps', 'cable', 75, 'weightReps', []],

  // ─────────────────────────────── Tríceps ───────────────────────────────
  ['press-frances', 'Press francés', 'triceps', 'barbell', 90, 'weightReps', [], ['skull crusher', 'frances']],
  ['extension-polea', 'Extensión de tríceps en polea', 'triceps', 'cable', 75, 'weightReps', [], ['jalon triceps', 'pushdown']],
  ['extension-polea-cuerda', 'Extensión en polea con cuerda', 'triceps', 'cable', 75, 'weightReps', [], ['cuerda']],
  ['extension-sobre-cabeza', 'Extensión sobre la cabeza', 'triceps', 'dumbbell', 90, 'weightReps', []],
  ['patada-triceps', 'Patada de tríceps', 'triceps', 'dumbbell', 75, 'weightReps', [], ['kickback']],
  ['fondos-banco', 'Fondos en banco', 'triceps', 'bodyweight', 90, 'bodyweightReps', ['chest'], ['fondos de triceps']],
  ['press-cerrado', 'Press de banca agarre cerrado', 'triceps', 'barbell', 150, 'weightReps', ['chest'], ['agarre cerrado']],

  // ─────────────────────────────── Pierna ───────────────────────────────
  ['sentadilla', 'Sentadilla', 'quads', 'barbell', 240, 'weightReps', ['glutes', 'hamstrings'], ['squat', 'sentadillas']],
  ['sentadilla-frontal', 'Sentadilla frontal', 'quads', 'barbell', 210, 'weightReps', ['glutes', 'core'], ['front squat']],
  ['sentadilla-goblet', 'Sentadilla goblet', 'quads', 'dumbbell', 120, 'weightReps', ['glutes'], ['goblet']],
  ['prensa', 'Prensa de piernas', 'quads', 'machine', 180, 'weightReps', ['glutes'], ['prensa', 'leg press']],
  ['hack', 'Hack squat', 'quads', 'machine', 180, 'weightReps', ['glutes']],
  ['extension-cuadriceps', 'Extensión de cuádriceps', 'quads', 'machine', 90, 'weightReps', [], ['extensiones', 'leg extension']],
  ['curl-femoral', 'Curl femoral tumbado', 'hamstrings', 'machine', 90, 'weightReps', [], ['femoral', 'leg curl']],
  ['curl-femoral-sentado', 'Curl femoral sentado', 'hamstrings', 'machine', 90, 'weightReps', []],
  ['zancadas', 'Zancadas', 'quads', 'dumbbell', 120, 'weightReps', ['glutes'], ['lunges', 'zancada']],
  ['bulgara', 'Sentadilla búlgara', 'quads', 'dumbbell', 150, 'weightReps', ['glutes'], ['bulgaras', 'bulgarian split squat']],
  ['hip-thrust', 'Hip thrust', 'glutes', 'barbell', 180, 'weightReps', ['hamstrings'], ['empuje de cadera']],
  ['puente-gluteo', 'Puente de glúteo', 'glutes', 'bodyweight', 90, 'weightedBodyweight', ['hamstrings']],
  ['patada-gluteo-polea', 'Patada de glúteo en polea', 'glutes', 'cable', 75, 'weightReps', []],
  ['abductores', 'Abductores en máquina', 'glutes', 'machine', 75, 'weightReps', []],
  ['aductores', 'Aductores en máquina', 'quads', 'machine', 75, 'weightReps', []],
  ['gemelos-pie', 'Elevación de gemelos de pie', 'calves', 'machine', 75, 'weightReps', [], ['gemelos']],
  ['gemelos-sentado', 'Elevación de gemelos sentado', 'calves', 'machine', 75, 'weightReps', [], ['soleo']],
  ['peso-muerto-piernas-rigidas', 'Peso muerto piernas rígidas', 'hamstrings', 'barbell', 180, 'weightReps', ['glutes', 'back']],

  // ─────────────────────────────── Core ───────────────────────────────
  ['plancha', 'Plancha', 'core', 'bodyweight', 60, 'time', [], ['plank']],
  ['plancha-lateral', 'Plancha lateral', 'core', 'bodyweight', 60, 'time', []],
  ['crunch', 'Crunch abdominal', 'core', 'bodyweight', 60, 'bodyweightReps', [], ['abdominales', 'encogimientos abdominales']],
  ['crunch-polea', 'Crunch en polea', 'core', 'cable', 75, 'weightReps', []],
  ['elevacion-piernas', 'Elevación de piernas colgado', 'core', 'bodyweight', 90, 'bodyweightReps', [], ['elevaciones de piernas']],
  ['rueda-abdominal', 'Rueda abdominal', 'core', 'other', 90, 'bodyweightReps', [], ['ab wheel']],
  ['russian-twist', 'Giro ruso', 'core', 'dumbbell', 60, 'weightReps', [], ['russian twist']],
  ['hollow', 'Hollow hold', 'core', 'bodyweight', 60, 'time', []],
  ['mountain-climbers', 'Escaladores', 'core', 'bodyweight', 45, 'time', ['cardio'], ['mountain climbers']],

  // ─────────────────────────────── Cuerpo completo y cardio ───────────────────────────────
  ['burpees', 'Burpees', 'fullBody', 'bodyweight', 90, 'bodyweightReps', ['cardio']],
  ['clean', 'Cargada', 'fullBody', 'barbell', 180, 'weightReps', ['back', 'quads'], ['clean', 'cargada de potencia']],
  ['push-press', 'Push press', 'shoulders', 'barbell', 180, 'weightReps', ['triceps', 'quads']],
  ['thruster', 'Thruster', 'fullBody', 'barbell', 150, 'weightReps', ['shoulders', 'quads']],
  ['swing-kettlebell', 'Swing con kettlebell', 'glutes', 'kettlebell', 90, 'weightReps', ['hamstrings', 'cardio'], ['swing']],
  ['farmer-walk', 'Paseo del granjero', 'forearms', 'dumbbell', 120, 'time', ['core', 'fullBody'], ['farmer walk']],
  ['cinta', 'Cinta de correr', 'cardio', 'machine', 0, 'distance', [], ['correr', 'treadmill']],
  ['bici-estatica', 'Bicicleta estática', 'cardio', 'machine', 0, 'distance', [], ['bici']],
  ['eliptica', 'Elíptica', 'cardio', 'machine', 0, 'distance', []],
  ['remo-ergometro', 'Remo ergómetro', 'cardio', 'machine', 0, 'distance', ['back'], ['remoergometro', 'rower']],
  ['comba', 'Comba', 'cardio', 'other', 60, 'time', [], ['saltar a la comba']],
  ['escaleras', 'Escaladora', 'cardio', 'machine', 0, 'time', ['quads'], ['stairmaster']],

  // ─────────────────────────────── Antebrazo ───────────────────────────────
  ['curl-muneca', 'Curl de muñeca', 'forearms', 'barbell', 60, 'weightReps', []],
  ['dead-hang', 'Colgarse de la barra', 'forearms', 'bodyweight', 60, 'time', ['back'], ['dead hang']],
];

function expand(row: Row): Exercise {
  const [id, name, muscle, equipment, rest, kind = 'weightReps', secondary = [], aliases = []] = row;
  return {
    id,
    name,
    aliases: [name.toLowerCase(), ...aliases],
    muscle,
    secondary,
    equipment,
    kind,
    rest,
    custom: false,
  };
}

export const EXERCISES: Exercise[] = ROWS.map(expand);

export const EXERCISES_BY_ID = new Map(EXERCISES.map((e) => [e.id, e]));

/** Orden en que se muestran los grupos: los grandes primero. */
export const MUSCLE_ORDER: MuscleGroup[] = [
  'chest', 'back', 'shoulders', 'biceps', 'triceps', 'quads', 'hamstrings',
  'glutes', 'calves', 'core', 'forearms', 'fullBody', 'cardio',
];
