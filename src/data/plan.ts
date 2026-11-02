import type { MealSlot } from '../domain/types';

/**
 * El plan nutricional de Nacho, tal y como está en su hoja.
 *
 * Esto NO es una recomendación de la app: son las cantidades que le pasaron y
 * que él sigue. La app las obedece en vez de calcular las suyas, y por eso los
 * objetivos entran como `manual`, que es lo que impide que el ajuste automático
 * se los corrija por detrás.
 *
 * Todo lo que hay aquí sale de la hoja y nada se inventa. Dos reglas suyas que
 * conviene no perder de vista al leer las cantidades:
 *
 *   - El arroz y la pasta se pesan EN SECO.
 *   - La carne y el pescado, EN CRUDO.
 *
 * Por eso cada línea apunta al alimento crudo o seco de la base, no al cocinado:
 * convertir a ojo es justo el error que esta app existe para no cometer.
 */

/** Una línea de una comida del plan: un alimento de la base y sus gramos. */
export interface PlanPart {
  foodId: string;
  grams: number;
  /** Cuando la hoja da un margen ("180–200 g"), el otro extremo. */
  maxGrams?: number;
}

export interface PlanMeal {
  id: string;
  /** Cómo lo llama la hoja: «Comida · táper». */
  name: string;
  slot: MealSlot;
  parts: PlanPart[];
  /** La nota de la hoja, literal en lo esencial. */
  note: string;
  /** Las kcal aproximadas que da la hoja, para poder contrastarlas. */
  kcalFrom: number;
  kcalTo: number;
  /** El desayuno es opcional según la hoja. */
  optional?: boolean;
}

/** Objetivos de la hoja. Rango, no número: es como está escrito. */
export const PLAN_TARGETS = {
  kcal: { min: 2300, max: 2500 },
  protein: { min: 125, max: 140 },
  /** Peso al que se escribió la hoja, para saber cuándo se queda vieja. */
  weightKg: 67,
  goal: 'ganar músculo y mejorar la definición',
} as const;

/** Días de entrenamiento: lunes, miércoles y viernes. 1 = lunes. */
export const PLAN_TRAINING_DAYS = [1, 3, 5];

/** «Comida base real» de la hoja, la que repite. */
export const PLAN_BASE_MEAL = 'Arroz + carne + 1–2 huevos + tomate';

/**
 * Las comidas del día de entrenamiento, en orden.
 *
 * La cena que trae la hoja aquí es «de ejemplo»: es la del lunes, y la propia
 * hoja dice que se cambie por cualquiera de las de rotación. Por eso la cena no
 * está en esta lista: la pone PLAN_DINNERS según el día.
 */
export const PLAN_MEALS: PlanMeal[] = [
  {
    id: 'plan-manana',
    name: 'Mañana',
    slot: 'breakfast',
    parts: [
      { foodId: 'cafe', grams: 60 },
      { foodId: 'bebida-soja', grams: 200 },
    ],
    note: 'Desayuno opcional; si lo omites, reparte más comida en el resto del día. Con hambre: 40 g de pan integral + 40 g de pavo.',
    kcalFrom: 100,
    kcalTo: 250,
    optional: true,
  },
  {
    id: 'plan-taper',
    name: 'Comida · táper',
    slot: 'lunch',
    parts: [
      { foodId: 'arroz-crudo', grams: 120 },
      { foodId: 'pollo-pechuga-cruda', grams: 180, maxGrams: 200 },
      { foodId: 'huevo', grams: 110 },
      { foodId: 'tomate', grams: 200 },
      { foodId: 'aceite-oliva', grams: 7 },
    ],
    note: 'Tu comida base. Si la carne es más grasa o usas más aceite, suben las calorías. Arroz pesado en seco, carne en crudo.',
    kcalFrom: 850,
    kcalTo: 1050,
  },
  {
    id: 'plan-merienda',
    name: 'Merienda · entreno',
    slot: 'snack',
    parts: [
      { foodId: 'platano', grams: 120 },
      { foodId: 'yogur-proteico', grams: 175 },
    ],
    note: 'Antes o después de entrenar, según horario. Si no tomas yogur, suma esa proteína en otra comida.',
    kcalFrom: 190,
    kcalTo: 250,
  },
];

/** Las siete cenas para rotar, en el día que les toca. 0 = domingo. */
export interface PlanDinner {
  /** Día de la semana, 0 = domingo. */
  weekday: number;
  name: string;
  parts: PlanPart[];
  /** Aviso de la hoja, cuando lo hay. */
  note?: string;
}

export const PLAN_DINNERS: PlanDinner[] = [
  {
    weekday: 1,
    name: 'Pasta boloñesa',
    parts: [
      { foodId: 'pasta-cruda', grams: 100 },
      { foodId: 'ternera-picada-5-cruda', grams: 150 },
      { foodId: 'tomate', grams: 150 },
      { foodId: 'queso-rallado', grams: 15 },
      { foodId: 'aceite-oliva', grams: 5 },
    ],
  },
  {
    weekday: 2,
    name: 'Fajitas de pollo',
    parts: [
      { foodId: 'pollo-pechuga-cruda', grams: 180 },
      { foodId: 'tortilla-trigo', grams: 120 },
      { foodId: 'pimiento-rojo', grams: 150 },
      { foodId: 'yogur-natural', grams: 40 },
      { foodId: 'aceite-oliva', grams: 5 },
    ],
  },
  {
    weekday: 3,
    name: 'Tortilla de patata',
    parts: [
      { foodId: 'huevo', grams: 165 },
      { foodId: 'patata-cruda', grams: 300 },
      { foodId: 'aceite-oliva', grams: 5 },
      { foodId: 'pan-integral', grams: 60 },
      { foodId: 'tomate', grams: 100 },
    ],
  },
  {
    weekday: 4,
    name: 'Pescado con patata',
    parts: [
      { foodId: 'merluza-cruda', grams: 200 },
      { foodId: 'patata-cruda', grams: 350 },
      { foodId: 'judias-verdes', grams: 200 },
      { foodId: 'aceite-oliva', grams: 10 },
    ],
  },
  {
    weekday: 5,
    name: 'Hamburguesa casera',
    parts: [
      { foodId: 'ternera-picada-5-cruda', grams: 180 },
      { foodId: 'pan-hamburguesa', grams: 80 },
      { foodId: 'patatas-horno', grams: 200 },
      { foodId: 'aceite-oliva', grams: 5 },
    ],
  },
  {
    weekday: 6,
    name: 'Pizza casera',
    parts: [
      { foodId: 'masa-pizza', grams: 150 },
      { foodId: 'mozzarella', grams: 100 },
      { foodId: 'jamon-cocido', grams: 80 },
      { foodId: 'tomate-frito', grams: 100 },
    ],
    note: 'La masa preparada cambia mucho de marca a marca: revisa la etiqueta.',
  },
  {
    weekday: 0,
    name: 'Revuelto completo',
    parts: [
      { foodId: 'huevo', grams: 165 },
      { foodId: 'huevo-clara', grams: 150 },
      { foodId: 'patata-cruda', grams: 250 },
      { foodId: 'pan-integral', grams: 60 },
      { foodId: 'aceite-oliva', grams: 5 },
    ],
  },
];

/** La cena que toca hoy. */
export function dinnerFor(weekday: number): PlanDinner {
  return PLAN_DINNERS.find((d) => d.weekday === weekday) ?? PLAN_DINNERS[0];
}

/** ¿Hoy toca entrenar, según el plan? */
export function isTrainingDay(weekday: number): boolean {
  return PLAN_TRAINING_DAYS.includes(weekday);
}

/** Las notas al pie de la hoja, que son parte del plan y no adorno. */
export const PLAN_NOTES = {
  antojos: 'Puedes reservar 100–200 kcal para chocolate o chuches. No hace falta compensar después.',
  descanso: 'Lunes, miércoles y viernes entrenas. Los demás días mantén las comidas normales: también se recupera comiendo.',
  seguimiento: 'Pésate 3–4 mañanas por semana y compara medias de 2–3 semanas. Ajusta según peso, fuerza, hambre y cintura.',
  pesos: 'Arroz y pasta, en seco. Carne y pescado, en crudo. Las calorías son aproximadas: ajusta con las etiquetas y con tu evolución real.',
} as const;
