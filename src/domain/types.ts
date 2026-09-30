/**
 * Modelo de dominio de FitMe.
 *
 * Principio rector: los números son una herramienta, no un juicio. Por eso casi
 * todo objetivo se expresa como { objetivo, min, max } y casi toda cantidad
 * lleva un nivel de confianza explícito.
 */

/** Fecha local en formato YYYY-MM-DD (nunca UTC: el día del usuario es local). */
export type IsoDate = string;

// ───────────────────────────── Nutrientes ─────────────────────────────

/** Nutrientes por los que se rige la app. Todo en gramos salvo kcal y sodio (mg). */
export interface Nutrients {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
  /** Opcionales: se muestran en segundo plano, nunca dominan la interfaz. */
  satFat?: number;
  sugars?: number;
  sodium?: number;
}

export const EMPTY_NUTRIENTS: Nutrients = {
  kcal: 0,
  protein: 0,
  carbs: 0,
  fat: 0,
  fiber: 0,
  satFat: 0,
  sugars: 0,
  sodium: 0,
};

export type MacroKey = 'kcal' | 'protein' | 'carbs' | 'fat' | 'fiber';
export const MACRO_KEYS: MacroKey[] = ['kcal', 'protein', 'carbs', 'fat', 'fiber'];

// ───────────────────────────── Alimentos ─────────────────────────────

/**
 * Estado del alimento. Distinguir crudo de cocinado es obligatorio: 100 g de
 * arroz crudo son ~355 kcal y 100 g de arroz cocinado ~130 kcal. Confundirlos
 * es la fuente de error más habitual en los contadores de macros.
 */
export type FoodState = 'raw' | 'cooked' | 'product' | 'asIs';

export type FoodCategory =
  | 'protein'
  | 'carb'
  | 'vegetable'
  | 'fruit'
  | 'dairy'
  | 'fat'
  | 'drink'
  | 'other';

/** Fuente de proteína, para vigilar la variedad sin moralizar. */
export type ProteinSource =
  | 'egg'
  | 'poultry'
  | 'redMeat'
  | 'fish'
  | 'dairy'
  | 'soy'
  | 'legume'
  | 'cereal'
  | 'supplement'
  | 'none';

export interface Portion {
  /** "unidad", "plato", "puñado", "cucharada"… */
  label: string;
  grams: number;
  /** Ración por defecto que se ofrece al registrar. */
  isDefault?: boolean;
}

export interface Food {
  id: string;
  name: string;
  /** Sinónimos y variantes para el buscador y el parser de voz. */
  aliases: string[];
  brand?: string;
  barcode?: string;
  state: FoodState;
  category: FoodCategory;
  proteinSource: ProteinSource;
  /** Nutrientes por 100 g (o por 100 ml en líquidos). */
  per100g: Nutrients;
  /** Unidad de medida base. */
  unit: 'g' | 'ml';
  portions: Portion[];
  /**
   * Factor de rendimiento al cocinar. 100 g de arroz crudo → ~250 g cocinado.
   * Permite convertir entre estados sin inventar datos.
   */
  cookedYield?: number;
  /** Id del mismo alimento en el otro estado, si existe en la base. */
  counterpartId?: string;
  /** Tolerancia digestiva estimada: alto = más probable que hinche. */
  fermentability?: 'low' | 'medium' | 'high';
  /** Densidad energética: útil cuando hay poco apetito. */
  volumeIndex?: 'low' | 'medium' | 'high';
  /** true si lo creó el usuario (etiqueta escaneada, producto propio…). */
  custom?: boolean;
  createdAt?: number;
}

// ───────────────────────────── Registro ─────────────────────────────

export type MealSlot = 'breakfast' | 'lunch' | 'snack' | 'dinner' | 'extra';

export const MEAL_SLOTS: MealSlot[] = ['breakfast', 'lunch', 'snack', 'dinner', 'extra'];

export const MEAL_SLOT_LABEL: Record<MealSlot, string> = {
  breakfast: 'Desayuno',
  lunch: 'Comida',
  snack: 'Merienda',
  dinner: 'Cena',
  extra: 'Extra',
};

/**
 * Confianza de la cantidad. Se muestra siempre al usuario: la app no finge
 * precisión que no tiene.
 */
export type Confidence = 'exact' | 'estimated' | 'rough';

export interface LoggedItem {
  id: string;
  foodId: string;
  /** Copia del nombre por si el alimento se borra o renombra después. */
  foodName: string;
  quantity: number;
  unit: 'g' | 'ml' | 'portion';
  /** Etiqueta de la ración usada, si se registró por raciones. */
  portionLabel?: string;
  /** Gramos efectivos tras resolver raciones. Es lo que se usa para calcular. */
  grams: number;
  confidence: Confidence;
  nutrients: Nutrients;
}

export type LogMethod = 'manual' | 'voice' | 'photo' | 'barcode' | 'saved' | 'recipe' | 'label';

export interface MealEntry {
  id: string;
  date: IsoDate;
  slot: MealSlot;
  /** Hora local HH:MM, para analizar distribución de proteína. */
  time: string;
  name?: string;
  items: LoggedItem[];
  method: LogMethod;
  /** Transcripción de voz o nota original, para poder auditar la estimación. */
  sourceNote?: string;
  /** Id de la receta si la comida vino de una. */
  recipeId?: string;
  createdAt: number;
}

// ───────────────────────────── Recetas y favoritos ─────────────────────────────

export interface RecipeIngredient {
  foodId: string;
  grams: number;
}

export interface Recipe {
  id: string;
  name: string;
  aliases: string[];
  ingredients: RecipeIngredient[];
  servings: number;
  /** Minutos aproximados de preparación: alimenta el modo "no quiero cocinar". */
  prepMinutes: number;
  tags: string[];
  /** Veces que se ha registrado: el sistema aprende qué usas de verdad. */
  useCount: number;
  lastUsedAt?: number;
  createdAt: number;
}

export interface SavedMeal {
  id: string;
  name: string;
  items: Omit<LoggedItem, 'id'>[];
  slotHint?: MealSlot;
  prepMinutes: number;
  useCount: number;
  lastUsedAt?: number;
  createdAt: number;
}

// ───────────────────────────── Día ─────────────────────────────

export type Hunger = 'high' | 'normal' | 'low' | 'veryLow';
export type Digestion = 'good' | 'bloated' | 'bad';

export interface TrainingSet {
  exercise: string;
  sets: number;
  reps: string;
  weightKg?: number;
}

export interface TrainingSession {
  /** "Pecho", "Espalda", "Pierna"… libre. */
  focus: string;
  minutes: number;
  exercises: TrainingSet[];
  /** Percepción de rendimiento 1–5: señal para el motor de tendencias. */
  performance?: number;
  location?: 'home' | 'gym';
}

export interface DayLog {
  date: IsoDate;
  steps?: number;
  hunger?: Hunger;
  digestion?: Digestion;
  training?: TrainingSession;
  /** Calorías que reporta el reloj. Se guardan como SEÑAL, nunca como verdad. */
  deviceKcal?: number;
  note?: string;
  /** Objetivos efectivos del día (se congelan al cerrarlo, para el histórico). */
  targetsSnapshot?: MacroTargets;
}

export interface WeightEntry {
  id: string;
  date: IsoDate;
  time: string;
  kg: number;
  /** Condiciones opcionales: ayunas, después de entrenar, etc. */
  conditions?: string;
  bodyFatPct?: number;
  waistCm?: number;
}

// ───────────────────────────── Objetivos ─────────────────────────────

export interface TargetRange {
  target: number;
  min: number;
  max: number;
}

export interface MacroTargets {
  kcal: TargetRange;
  protein: TargetRange;
  carbs: TargetRange;
  fat: TargetRange;
  fiber: TargetRange;
  /** Cómo se obtuvieron: cálculo inicial, ajuste automático o edición manual. */
  origin: 'computed' | 'adjusted' | 'manual';
  /** Explicación legible para el botón "¿Por qué?". */
  rationale: string[];
}

/** Tipo de día: modula energía, no proteína. */
export type DayType = 'training' | 'rest' | 'highActivity' | 'lowActivity';

export const DAY_TYPE_LABEL: Record<DayType, string> = {
  training: 'Día de entrenamiento',
  rest: 'Día de descanso',
  highActivity: 'Día de mucha actividad',
  lowActivity: 'Día de poca actividad',
};

// ───────────────────────────── Perfil ─────────────────────────────

export type Sex = 'male' | 'female';
export type ActivityLevel = 'sedentary' | 'light' | 'moderate' | 'active' | 'veryActive';
export type Goal = 'leanGain' | 'maintain' | 'recomp' | 'slowCut';

export const GOAL_LABEL: Record<Goal, string> = {
  leanGain: 'Ganancia muscular controlada',
  maintain: 'Mantenimiento',
  recomp: 'Recomposición',
  slowCut: 'Definición suave',
};

export interface Profile {
  id: 'me';
  name?: string;
  sex: Sex;
  birthYear: number;
  heightCm: number;
  /** Peso de referencia. El peso real vivo sale de la media móvil de pesadas. */
  startWeightKg: number;
  activityLevel: ActivityLevel;
  typicalSteps: number;
  trainingDaysPerWeek: number;
  trainingStyle: string;
  trainingTime: string;
  trainingLocation: 'home' | 'gym' | 'both';
  goal: Goal;
  /** Horario habitual de comidas: HH:MM por slot. */
  mealTimes: Partial<Record<MealSlot, string>>;
  /** Ids de alimentos habituales, marcados en el onboarding. */
  pantryFoodIds: string[];
  restrictions: string[];
  dislikes: string[];
  appetite: Hunger;
  budget: 'low' | 'medium' | 'high';
  /** Objetivos vigentes. Editables a mano. */
  targets: MacroTargets;
  /** Ajuste manual de calorías sobre el cálculo, en kcal. */
  manualKcalOffset: number;
  onboardedAt?: number;
  updatedAt: number;
}

// ───────────────────────────── Motor de tendencias ─────────────────────────────

export interface WeeklySummary {
  /** Lunes de la semana, YYYY-MM-DD. */
  weekStart: IsoDate;
  daysLogged: number;
  avgKcal: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  avgFiber: number;
  avgSteps: number;
  trainings: number;
  avgWeightKg: number | null;
  /** Días con al menos una comida registrada / 7. */
  loggingRate: number;
  consistency: ConsistencyScore;
}

export interface ConsistencyScore {
  /** 0–100. No es una nota moral: mide si hay datos suficientes para decidir. */
  value: number;
  proteinOk: number;
  energyOk: number;
  loggedDays: number;
  trainings: number;
  label: string;
}

export interface TrendReading {
  /** Media móvil de 7 días del peso, si hay datos. */
  weightMa7: number | null;
  weightMa7Prev: number | null;
  /** kg por semana según regresión sobre las pesadas disponibles. */
  weeklyChangeKg: number | null;
  /** Días con pesada en las últimas 2 semanas. */
  weighInDays: number;
  direction: 'up' | 'down' | 'flat' | 'unknown';
}

export type AdjustmentAction = 'increase' | 'decrease' | 'hold' | 'needMoreData';

export interface AdjustmentSuggestion {
  action: AdjustmentAction;
  /** Cambio propuesto en kcal/día. Siempre gradual. */
  deltaKcal: number;
  reasons: string[];
  /** Qué falta para poder decidir, si action === 'needMoreData'. */
  missing: string[];
  confidence: 'low' | 'medium' | 'high';
}

// ───────────────────────────── Recomendaciones ─────────────────────────────

export interface RemainingMacros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number;
}

export interface MealSuggestion {
  id: string;
  title: string;
  /** Alimentos y gramos concretos, listos para registrar de un toque. */
  items: { foodId: string; foodName: string; grams: number; unit: 'g' | 'ml' }[];
  nutrients: Nutrients;
  prepMinutes: number;
  /** Por qué se propone: alimenta el botón "¿Por qué?". */
  why: string[];
  /** Puntuación interna del algoritmo, para depurar y ordenar. */
  score: number;
  recipeId?: string;
  savedMealId?: string;
}

export interface SuggestionContext {
  remaining: RemainingMacros;
  targets: MacroTargets;
  consumed: Nutrients;
  dayType: DayType;
  hunger: Hunger;
  digestion: Digestion;
  /** Hora local HH:MM. */
  now: string;
  slot: MealSlot;
  trained: boolean;
  /** Restringe a lo que hay en casa, si el usuario lo indica. */
  availableFoodIds?: string[];
  maxPrepMinutes?: number;
  /** Modo "no quiero cocinar" / "cena rápida". */
  mode?: 'normal' | 'quick' | 'noCook';
  restrictions: string[];
  dislikes: string[];
}

// ───────────────────────────── Ajustes de app ─────────────────────────────

export interface AppSettings {
  id: 'settings';
  /** Clave de la API de IA, guardada solo en este dispositivo. */
  aiApiKey?: string;
  aiProvider: 'anthropic' | 'none';
  aiModel: string;
  /** Mostrar u ocultar micronutrientes secundarios. */
  showSecondaryNutrients: boolean;
  theme: 'dark' | 'light' | 'system';
  lastBackupAt?: number;
}
