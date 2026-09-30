import { useLiveQuery } from 'dexie-react-hooks';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode,
} from 'react';
import {
  DEFAULT_SETTINGS, addEntry, addWeight, allFoods, db, deleteEntry, deleteWeight, getSettings,
  makeDefaultProfile, markRecipeUsed, markSavedMealUsed, newId, saveProfile, saveSettings,
  seedIfNeeded, upsertDay, upsertFood, upsertRecipe, upsertSavedMeal,
} from '../data/db';
import { addDays, lastNDays, nowTime, toIsoDate } from '../domain/dates';
import {
  classifyDay, computeTargets, profileAge, remainingFor, targetsForDay,
} from '../domain/nutrition';
import { buildIndex, type FoodIndex } from '../domain/parser';
import { groupEntriesByDate, nutrientsForEntries } from '../domain/trends';
import type {
  AppSettings, DayLog, DayType, Food, IsoDate, MacroTargets, MealEntry, MealSlot, Nutrients,
  Profile, Recipe, RemainingMacros, SavedMeal, WeightEntry,
} from '../domain/types';

/** Días de histórico que se mantienen en memoria para las vistas de progreso. */
const HISTORY_DAYS = 120;

interface AppContextValue {
  ready: boolean;
  needsOnboarding: boolean;
  profile: Profile | null;
  settings: AppSettings;
  foods: Food[];
  foodsById: Map<string, Food>;
  foodIndex: FoodIndex;
  recipes: Recipe[];
  savedMeals: SavedMeal[];

  /** Fecha activa (normalmente hoy, pero el historial permite mirar atrás). */
  date: IsoDate;
  setDate: (d: IsoDate) => void;
  isToday: boolean;

  entries: MealEntry[];
  day: DayLog | null;
  weights: WeightEntry[];
  history: { entries: MealEntry[]; days: Map<IsoDate, DayLog> };

  /** Objetivos medios del perfil, sin modular por tipo de día. */
  baseTargets: MacroTargets;
  /** Objetivos del día activo, ya modulados por entrenamiento y actividad. */
  targets: MacroTargets;
  dayType: DayType;
  consumed: Nutrients;
  remaining: RemainingMacros;

  actions: {
    saveProfile: (p: Profile) => Promise<void>;
    recomputeTargets: (p?: Profile) => Promise<void>;
    setSettings: (s: Partial<AppSettings>) => Promise<void>;
    addEntry: (e: Omit<MealEntry, 'id' | 'createdAt'>) => Promise<string>;
    deleteEntry: (id: string) => Promise<void>;
    patchDay: (patch: Partial<DayLog>) => Promise<void>;
    addWeight: (kg: number, opts?: Partial<WeightEntry>) => Promise<void>;
    deleteWeight: (id: string) => Promise<void>;
    upsertFood: (f: Food) => Promise<void>;
    upsertRecipe: (r: Recipe) => Promise<void>;
    upsertSavedMeal: (m: SavedMeal) => Promise<void>;
    markRecipeUsed: (id: string) => Promise<void>;
    markSavedMealUsed: (id: string) => Promise<void>;
  };
}

const AppContext = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [date, setDate] = useState<IsoDate>(() => toIsoDate());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      await seedIfNeeded();
      if (!cancelled) setReady(true);
    })().catch((err) => {
      console.error('No se ha podido abrir la base de datos local', err);
      if (!cancelled) setReady(true);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  // Si la app queda abierta y cambia el día, la fecha activa se pone al día.
  useEffect(() => {
    const tick = window.setInterval(() => {
      const t = toIsoDate();
      setDate((prev) => (prev === t ? prev : prev === toIsoDate(new Date(Date.now() - 60_000)) ? t : prev));
    }, 60_000);
    return () => window.clearInterval(tick);
  }, []);

  const profile = useLiveQuery(() => db.profile.get('me'), [], undefined);
  const settings = useLiveQuery(() => getSettings(), [], DEFAULT_SETTINGS) ?? DEFAULT_SETTINGS;
  const foods = useLiveQuery(() => allFoods(), [], [] as Food[]) ?? [];
  const recipes = useLiveQuery(() => db.recipes.toArray(), [], [] as Recipe[]) ?? [];
  const savedMeals = useLiveQuery(() => db.savedMeals.toArray(), [], [] as SavedMeal[]) ?? [];
  const weights = useLiveQuery(
    () => db.weights.toArray().then((w) => w.sort((a, b) => a.date.localeCompare(b.date))),
    [],
    [] as WeightEntry[],
  ) ?? [];

  const from = useMemo(() => addDays(toIsoDate(), -HISTORY_DAYS), []);
  const historyEntries = useLiveQuery(
    () => db.entries.where('date').between(from, addDays(toIsoDate(), 1), true, true).toArray(),
    [from],
    [] as MealEntry[],
  ) ?? [];
  const historyDays = useLiveQuery(
    () => db.days.where('date').between(from, addDays(toIsoDate(), 1), true, true).toArray(),
    [from],
    [] as DayLog[],
  ) ?? [];

  const entriesByDate = useMemo(() => groupEntriesByDate(historyEntries), [historyEntries]);
  const daysByDate = useMemo(
    () => new Map(historyDays.map((d) => [d.date, d] as const)),
    [historyDays],
  );

  const entries = useMemo(() => {
    const list = entriesByDate.get(date) ?? [];
    return [...list].sort((a, b) => a.time.localeCompare(b.time) || a.createdAt - b.createdAt);
  }, [entriesByDate, date]);

  const day = daysByDate.get(date) ?? null;

  const foodsById = useMemo(() => new Map(foods.map((f) => [f.id, f] as const)), [foods]);
  const foodIndex = useMemo<FoodIndex>(() => buildIndex(foods), [foods]);

  const baseTargets = useMemo<MacroTargets>(() => {
    if (profile) return profile.targets;
    return makeDefaultProfile().targets;
  }, [profile]);

  const dayType = useMemo<DayType>(
    () =>
      classifyDay({
        trained: !!day?.training,
        steps: day?.steps,
        typicalSteps: profile?.typicalSteps ?? 8000,
      }),
    [day, profile],
  );

  const targets = useMemo(() => targetsForDay(baseTargets, dayType), [baseTargets, dayType]);
  const consumed = useMemo(() => nutrientsForEntries(entries), [entries]);
  const remaining = useMemo(() => remainingFor(consumed, targets), [consumed, targets]);

  const doRecompute = useCallback(async (next?: Profile) => {
    const p = next ?? (await db.profile.get('me'));
    if (!p) return;
    // El peso de referencia es la media móvil reciente si existe, no la pesada
    // de hoy: los objetivos no deben bailar con el agua corporal.
    const recent = await db.weights.toArray();
    const last7 = lastNDays(10);
    const vals = recent.filter((w) => last7.includes(w.date)).map((w) => w.kg);
    const weightKg = vals.length >= 2 ? vals.reduce((a, b) => a + b, 0) / vals.length : p.startWeightKg;
    // Si el usuario reporta hinchazón a menudo, la fibra objetivo se moderará.
    const days = await db.days.toArray();
    const recentDays = days.filter((d) => d.date >= addDays(toIsoDate(), -21));
    const bloated = recentDays.filter((d) => d.digestion === 'bloated' || d.digestion === 'bad').length;
    const tolerance = recentDays.length >= 5 && bloated / recentDays.length > 0.3 ? 'low' : 'normal';

    const targets = computeTargets({
      sex: p.sex,
      weightKg,
      heightCm: p.heightCm,
      age: profileAge(p),
      activityLevel: p.activityLevel,
      typicalSteps: p.typicalSteps,
      trainingDaysPerWeek: p.trainingDaysPerWeek,
      goal: p.goal,
      kcalOffset: p.manualKcalOffset,
      digestiveTolerance: tolerance,
    });
    await saveProfile({ ...p, targets });
  }, []);

  const actions = useMemo<AppContextValue['actions']>(
    () => ({
      saveProfile: async (p) => {
        await saveProfile(p);
      },
      recomputeTargets: doRecompute,
      setSettings: async (s) => {
        await saveSettings(s);
      },
      addEntry: async (e) => {
        const id = newId('e-');
        await addEntry({ ...e, id, createdAt: Date.now() });
        return id;
      },
      deleteEntry,
      patchDay: async (patch) => {
        await upsertDay(date, patch);
      },
      addWeight: async (kg, opts) => {
        await addWeight({
          id: newId('w-'),
          date: opts?.date ?? date,
          time: opts?.time ?? nowTime(),
          kg,
          conditions: opts?.conditions,
          bodyFatPct: opts?.bodyFatPct,
          waistCm: opts?.waistCm,
        });
      },
      deleteWeight,
      upsertFood,
      upsertRecipe,
      upsertSavedMeal,
      markRecipeUsed,
      markSavedMealUsed,
    }),
    [date, doRecompute],
  );

  const value: AppContextValue = {
    ready: ready && foods.length > 0,
    needsOnboarding: ready && !profile,
    profile: profile ?? null,
    settings,
    foods,
    foodsById,
    foodIndex,
    recipes,
    savedMeals,
    date,
    setDate,
    isToday: date === toIsoDate(),
    entries,
    day,
    weights,
    history: { entries: historyEntries, days: daysByDate },
    baseTargets,
    targets,
    dayType,
    consumed,
    remaining,
    actions,
  };

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>;
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp debe usarse dentro de AppProvider');
  return ctx;
}

/** Slot de comida sugerido por la hora, según el horario del perfil. */
export function slotForTime(time: string, mealTimes: Partial<Record<MealSlot, string>>): MealSlot {
  const minutes = (t: string) => {
    const [h, m] = t.split(':').map(Number);
    return h * 60 + (m || 0);
  };
  const now = minutes(time);
  const defaults: Record<MealSlot, string> = {
    breakfast: mealTimes.breakfast ?? '11:00',
    lunch: mealTimes.lunch ?? '14:30',
    snack: mealTimes.snack ?? '18:00',
    dinner: mealTimes.dinner ?? '21:30',
    extra: '23:59',
  };
  // Se elige la comida cuyo horario habitual está más cerca de la hora actual.
  let best: MealSlot = 'extra';
  let bestDiff = Infinity;
  for (const slot of ['breakfast', 'lunch', 'snack', 'dinner'] as MealSlot[]) {
    const diff = Math.abs(now - minutes(defaults[slot]));
    if (diff < bestDiff) {
      bestDiff = diff;
      best = slot;
    }
  }
  // Más de 3 horas de distancia de cualquier comida habitual: es un extra.
  return bestDiff > 180 ? 'extra' : best;
}
