import Dexie, { type EntityTable } from 'dexie';
import { SEED_FOODS, SEED_VERSION } from './foods';
import { computeTargets } from '../domain/nutrition';
import type {
  AppSettings, DayLog, Food, IsoDate, MealEntry, Profile, Recipe, SavedMeal, WeightEntry,
} from '../domain/types';

/**
 * Almacenamiento local en IndexedDB.
 *
 * Todo vive en el dispositivo: no hay servidor, no hay cuentas y no se envía
 * nada a ningún sitio salvo que el usuario active explícitamente la búsqueda
 * por código de barras (OpenFoodFacts) o el análisis de fotos con IA.
 */

interface MetaRow {
  key: string;
  value: unknown;
}

export class FitMeDB extends Dexie {
  foods!: EntityTable<Food, 'id'>;
  entries!: EntityTable<MealEntry, 'id'>;
  days!: EntityTable<DayLog, 'date'>;
  weights!: EntityTable<WeightEntry, 'id'>;
  recipes!: EntityTable<Recipe, 'id'>;
  savedMeals!: EntityTable<SavedMeal, 'id'>;
  profile!: EntityTable<Profile, 'id'>;
  settings!: EntityTable<AppSettings, 'id'>;
  meta!: EntityTable<MetaRow, 'key'>;

  constructor() {
    super('fitme');
    this.version(1).stores({
      foods: 'id, name, barcode, category, custom',
      entries: 'id, date, slot, createdAt, [date+slot]',
      days: 'date',
      weights: 'id, date',
      recipes: 'id, name, useCount',
      savedMeals: 'id, name, useCount',
      profile: 'id',
      settings: 'id',
      meta: 'key',
    });
  }
}

export const db = new FitMeDB();

// ───────────────────────────── Siembra ─────────────────────────────

/**
 * Siembra la base de alimentos. Es idempotente y NO toca los alimentos que haya
 * creado el usuario: si sube la versión del seed, se refrescan solo los propios.
 */
export async function seedIfNeeded(): Promise<void> {
  const row = await db.meta.get('seedVersion');
  const current = typeof row?.value === 'number' ? row.value : 0;
  if (current >= SEED_VERSION) return;
  await db.transaction('rw', db.foods, db.meta, async () => {
    // bulkPut sobrescribe los del seed y deja intactos los personalizados.
    await db.foods.bulkPut(SEED_FOODS);
    await db.meta.put({ key: 'seedVersion', value: SEED_VERSION });
  });
}

// ───────────────────────────── Perfil ─────────────────────────────

export const DEFAULT_PROFILE_ID = 'me' as const;

/** Perfil de partida. Los objetivos se recalculan en el onboarding. */
export function makeDefaultProfile(): Profile {
  const base = {
    sex: 'male' as const,
    birthYear: new Date().getFullYear() - 25,
    heightCm: 175,
    startWeightKg: 66.5,
    activityLevel: 'moderate' as const,
    typicalSteps: 8000,
    trainingDaysPerWeek: 4,
    goal: 'leanGain' as const,
  };
  return {
    id: DEFAULT_PROFILE_ID,
    ...base,
    trainingStyle: 'Fuerza / hipertrofia',
    trainingTime: '19:30',
    trainingLocation: 'home',
    mealTimes: { breakfast: '11:00', lunch: '14:30', snack: '18:00', dinner: '21:30' },
    pantryFoodIds: [],
    restrictions: [],
    dislikes: [],
    appetite: 'normal',
    budget: 'medium',
    manualKcalOffset: 0,
    targets: computeTargets({
      sex: base.sex,
      weightKg: base.startWeightKg,
      heightCm: base.heightCm,
      age: 25,
      activityLevel: base.activityLevel,
      typicalSteps: base.typicalSteps,
      trainingDaysPerWeek: base.trainingDaysPerWeek,
      goal: base.goal,
    }),
    updatedAt: Date.now(),
  };
}

export async function getProfile(): Promise<Profile | undefined> {
  return db.profile.get(DEFAULT_PROFILE_ID);
}

export async function saveProfile(p: Profile): Promise<void> {
  await db.profile.put({ ...p, updatedAt: Date.now() });
}

export const DEFAULT_SETTINGS: AppSettings = {
  id: 'settings',
  aiProvider: 'none',
  aiModel: 'claude-sonnet-5-5',
  showSecondaryNutrients: false,
  theme: 'dark',
};

export async function getSettings(): Promise<AppSettings> {
  return (await db.settings.get('settings')) ?? DEFAULT_SETTINGS;
}

export async function saveSettings(s: Partial<AppSettings>): Promise<void> {
  const current = await getSettings();
  await db.settings.put({ ...current, ...s, id: 'settings' });
}

// ───────────────────────────── Comidas ─────────────────────────────

export async function addEntry(entry: MealEntry): Promise<void> {
  await db.entries.put(entry);
}

export async function deleteEntry(id: string): Promise<void> {
  await db.entries.delete(id);
}

export async function entriesForDate(date: IsoDate): Promise<MealEntry[]> {
  const list = await db.entries.where('date').equals(date).toArray();
  return list.sort((a, b) => a.time.localeCompare(b.time) || a.createdAt - b.createdAt);
}

export async function entriesBetween(from: IsoDate, to: IsoDate): Promise<MealEntry[]> {
  return db.entries.where('date').between(from, to, true, true).toArray();
}

// ───────────────────────────── Día ─────────────────────────────

export async function getDay(date: IsoDate): Promise<DayLog | undefined> {
  return db.days.get(date);
}

export async function upsertDay(date: IsoDate, patch: Partial<DayLog>): Promise<void> {
  const current = (await db.days.get(date)) ?? { date };
  await db.days.put({ ...current, ...patch, date });
}

export async function daysBetweenRange(from: IsoDate, to: IsoDate): Promise<DayLog[]> {
  return db.days.where('date').between(from, to, true, true).toArray();
}

// ───────────────────────────── Peso ─────────────────────────────

export async function addWeight(entry: WeightEntry): Promise<void> {
  await db.weights.put(entry);
}

export async function deleteWeight(id: string): Promise<void> {
  await db.weights.delete(id);
}

export async function allWeights(): Promise<WeightEntry[]> {
  const list = await db.weights.toArray();
  return list.sort((a, b) => a.date.localeCompare(b.date) || a.time.localeCompare(b.time));
}

// ───────────────────────────── Alimentos ─────────────────────────────

export async function allFoods(): Promise<Food[]> {
  return db.foods.toArray();
}

export async function upsertFood(food: Food): Promise<void> {
  await db.foods.put(food);
}

export async function findByBarcode(barcode: string): Promise<Food | undefined> {
  return db.foods.where('barcode').equals(barcode).first();
}

// ───────────────────────────── Recetas y favoritos ─────────────────────────────

export async function upsertRecipe(r: Recipe): Promise<void> {
  await db.recipes.put(r);
}

export async function upsertSavedMeal(m: SavedMeal): Promise<void> {
  await db.savedMeals.put(m);
}

/** El sistema aprende qué usa el usuario de verdad contando los usos. */
export async function markRecipeUsed(id: string): Promise<void> {
  const r = await db.recipes.get(id);
  if (r) await db.recipes.put({ ...r, useCount: r.useCount + 1, lastUsedAt: Date.now() });
}

export async function markSavedMealUsed(id: string): Promise<void> {
  const m = await db.savedMeals.get(id);
  if (m) await db.savedMeals.put({ ...m, useCount: m.useCount + 1, lastUsedAt: Date.now() });
}

// ───────────────────────────── Privacidad: exportar y borrar ─────────────────────────────

export interface ExportBundle {
  app: 'fitme';
  version: number;
  exportedAt: string;
  profile?: Profile;
  settings: Omit<AppSettings, 'aiApiKey'>;
  entries: MealEntry[];
  days: DayLog[];
  weights: WeightEntry[];
  recipes: Recipe[];
  savedMeals: SavedMeal[];
  /** Solo los alimentos creados por el usuario: el seed se regenera solo. */
  customFoods: Food[];
}

/**
 * Exporta todo lo que es del usuario, en JSON legible.
 *
 * La clave de la API NUNCA se exporta: es un secreto del dispositivo y no tiene
 * sentido que viaje dentro de una copia de seguridad.
 */
export async function exportAll(): Promise<ExportBundle> {
  const [profile, settings, entries, days, weights, recipes, savedMeals, foods] = await Promise.all([
    getProfile(),
    getSettings(),
    db.entries.toArray(),
    db.days.toArray(),
    allWeights(),
    db.recipes.toArray(),
    db.savedMeals.toArray(),
    db.foods.toArray(),
  ]);
  const { aiApiKey: _omitted, ...safeSettings } = settings;
  return {
    app: 'fitme',
    version: 1,
    exportedAt: new Date().toISOString(),
    profile,
    settings: safeSettings,
    entries,
    days,
    weights,
    recipes,
    savedMeals,
    customFoods: foods.filter((f) => f.custom),
  };
}

export async function importAll(bundle: ExportBundle, mode: 'merge' | 'replace'): Promise<void> {
  if (bundle.app !== 'fitme') throw new Error('Este archivo no es una copia de seguridad de FitMe.');
  await db.transaction(
    'rw',
    [db.profile, db.entries, db.days, db.weights, db.recipes, db.savedMeals, db.foods, db.settings],
    async () => {
      if (mode === 'replace') {
        await Promise.all([
          db.entries.clear(),
          db.days.clear(),
          db.weights.clear(),
          db.recipes.clear(),
          db.savedMeals.clear(),
          db.foods.filter((f) => !!f.custom).delete(),
        ]);
      }
      if (bundle.profile) await db.profile.put(bundle.profile);
      if (bundle.entries?.length) await db.entries.bulkPut(bundle.entries);
      if (bundle.days?.length) await db.days.bulkPut(bundle.days);
      if (bundle.weights?.length) await db.weights.bulkPut(bundle.weights);
      if (bundle.recipes?.length) await db.recipes.bulkPut(bundle.recipes);
      if (bundle.savedMeals?.length) await db.savedMeals.bulkPut(bundle.savedMeals);
      if (bundle.customFoods?.length) await db.foods.bulkPut(bundle.customFoods);
    },
  );
}

/** Borrado completo. Irreversible, y por eso la interfaz pide confirmación. */
export async function deleteAllData(): Promise<void> {
  await db.delete();
  await db.open();
  await seedIfNeeded();
}

export function newId(prefix = ''): string {
  const rnd =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);
  return `${prefix}${Date.now().toString(36)}-${rnd}`;
}
