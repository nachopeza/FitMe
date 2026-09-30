import { describe, expect, it } from 'vitest';
import { addDays, toIsoDate, weekStart } from './dates';
import { computeTargets } from './nutrition';
import {
  consistencyScore, dailyWeights, movingAverage, proteinDistribution, readTrend,
  suggestAdjustment, weeklySummary, weightSlopePerWeek,
} from './trends';
import { EMPTY_NUTRIENTS, type DayLog, type IsoDate, type MealEntry, type WeeklySummary, type WeightEntry } from './types';

const TODAY: IsoDate = '2026-03-15';
const targets = computeTargets({
  sex: 'male', weightKg: 66.5, heightCm: 175, age: 25, activityLevel: 'moderate',
  typicalSteps: 8000, trainingDaysPerWeek: 4, goal: 'leanGain',
});

function w(date: IsoDate, kg: number): WeightEntry {
  return { id: `${date}-${kg}`, date, time: '08:00', kg };
}

/** Serie de pesadas con una tendencia dada más ruido diario realista. */
function series(days: number, start: number, perWeek: number, noise = 0.5): WeightEntry[] {
  const out: WeightEntry[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const date = addDays(TODAY, -i);
    const drift = ((days - 1 - i) / 7) * perWeek;
    // Ruido determinista: agua, glucógeno, sodio, contenido intestinal.
    const wobble = Math.sin(i * 1.9) * noise;
    out.push(w(date, Math.round((start + drift + wobble) * 10) / 10));
  }
  return out;
}

describe('peso: nunca un solo día', () => {
  it('promedia varias pesadas del mismo día', () => {
    const d = dailyWeights([w(TODAY, 66), w(TODAY, 67)]);
    expect(d.get(TODAY)).toBe(66.5);
  });

  it('no calcula media móvil con una sola pesada', () => {
    expect(movingAverage(dailyWeights([w(TODAY, 66)]), TODAY, 7)).toBeNull();
  });

  it('una subida brusca de un día NO cambia la tendencia', () => {
    const estable = series(21, 66.5, 0);
    const conPico = [...estable.slice(0, -1), w(TODAY, 67.3)];
    const a = readTrend(estable, TODAY);
    const b = readTrend(conPico, TODAY);
    expect(b.direction).toBe(a.direction);
    expect(Math.abs((b.weeklyChangeKg ?? 0) - (a.weeklyChangeKg ?? 0))).toBeLessThan(0.15);
  });

  it('detecta una tendencia real de subida lenta', () => {
    const t = readTrend(series(21, 65.5, 0.25), TODAY);
    expect(t.direction).toBe('up');
    expect(t.weeklyChangeKg).toBeGreaterThan(0.1);
    expect(t.weeklyChangeKg).toBeLessThan(0.45);
  });

  it('llama "estable" a lo que está dentro del ruido', () => {
    expect(readTrend(series(21, 66.5, 0.05), TODAY).direction).toBe('flat');
  });

  it('no calcula pendiente con menos de cuatro pesadas', () => {
    expect(weightSlopePerWeek(dailyWeights(series(3, 66, 0.3)), addDays(TODAY, -20), TODAY)).toBeNull();
  });
});

describe('ajuste automático del objetivo', () => {
  function week(over: Partial<WeeklySummary> = {}): WeeklySummary {
    return {
      weekStart: weekStart(TODAY), daysLogged: 6, avgKcal: 2500, avgProtein: 135,
      avgCarbs: 300, avgFat: 75, avgFiber: 28, avgSteps: 8500, trainings: 4,
      avgWeightKg: 66.5, loggingRate: 6 / 7,
      consistency: consistencyScore({ proteinDays: 5, energyDays: 4, loggedDays: 6, trainings: 4, expectedTrainings: 4 }),
      ...over,
    };
  }

  it('no ajusta nada sin datos suficientes', () => {
    const s = suggestAdjustment({ goal: 'leanGain', weeks: [week()], trend: readTrend([], TODAY), targets });
    expect(s.action).toBe('needMoreData');
    expect(s.deltaKcal).toBe(0);
    expect(s.missing.length).toBeGreaterThan(0);
  });

  it('propone subir si el peso está plano entrenando y con proteína cubierta', () => {
    const s = suggestAdjustment({
      goal: 'leanGain', weeks: [week(), week()], trend: readTrend(series(21, 66.5, 0), TODAY), targets,
    });
    expect(s.action).toBe('increase');
    expect(s.deltaKcal).toBeGreaterThan(0);
    expect(s.deltaKcal).toBeLessThanOrEqual(150);
  });

  it('propone bajar si sube demasiado rápido, sin tocar la proteína', () => {
    const s = suggestAdjustment({
      goal: 'leanGain', weeks: [week(), week()], trend: readTrend(series(21, 64, 0.8), TODAY), targets,
    });
    expect(s.action).toBe('decrease');
    expect(s.deltaKcal).toBeLessThan(0);
    expect(s.deltaKcal).toBeGreaterThanOrEqual(-150);
    expect(s.reasons.join(' ')).toMatch(/sin tocar la proteína/i);
  });

  it('no toca nada si el ritmo está en la banda objetivo', () => {
    const s = suggestAdjustment({
      goal: 'leanGain', weeks: [week(), week()], trend: readTrend(series(21, 65.5, 0.2), TODAY), targets,
    });
    expect(s.action).toBe('hold');
    expect(s.deltaKcal).toBe(0);
  });

  it('antes de mover calorías exige asegurar la proteína', () => {
    const s = suggestAdjustment({
      goal: 'leanGain', weeks: [week({ avgProtein: 95 }), week({ avgProtein: 98 })],
      trend: readTrend(series(21, 66.5, 0), TODAY), targets,
    });
    expect(s.action).toBe('hold');
    expect(s.reasons.join(' ')).toMatch(/proteína/i);
  });

  it('los ajustes son siempre graduales', () => {
    const brutal = suggestAdjustment({
      goal: 'leanGain', weeks: [week(), week()], trend: readTrend(series(21, 60, 3), TODAY), targets,
    });
    expect(Math.abs(brutal.deltaKcal)).toBeLessThanOrEqual(150);
  });
});

describe('resumen semanal', () => {
  function entry(date: IsoDate, protein: number, kcal: number, time = '14:00'): MealEntry {
    return {
      id: `${date}-${time}`, date, slot: 'lunch', time, method: 'manual', createdAt: 0,
      items: [{ id: 'i', foodId: 'x', foodName: 'X', quantity: 1, unit: 'g', grams: 100,
        confidence: 'exact', nutrients: { ...EMPTY_NUTRIENTS, kcal, protein, carbs: 50, fat: 20, fiber: 5 } }],
    };
  }

  it('promedia solo los días con registro, no divide siempre por siete', () => {
    const start = weekStart(TODAY);
    const entries = [entry(start, 140, 2500), entry(addDays(start, 1), 130, 2400)];
    const s = weeklySummary({
      week: TODAY, entries, days: new Map<IsoDate, DayLog>(), weights: [], targets, expectedTrainings: 4,
    });
    expect(s.daysLogged).toBe(2);
    expect(s.avgKcal).toBe(2450);
    expect(s.avgProtein).toBe(135);
  });

  it('cuenta entrenamientos, pasos y peso medio', () => {
    const start = weekStart(TODAY);
    const days = new Map<IsoDate, DayLog>([
      [start, { date: start, steps: 10000, training: { focus: 'Pecho', minutes: 55, exercises: [] } }],
      [addDays(start, 1), { date: addDays(start, 1), steps: 6000 }],
    ]);
    const s = weeklySummary({
      week: TODAY, entries: [entry(start, 140, 2500)], days, weights: [w(start, 66.4), w(addDays(start, 1), 66.8)],
      targets, expectedTrainings: 4,
    });
    expect(s.trainings).toBe(1);
    expect(s.avgSteps).toBe(8000);
    expect(s.avgWeightKg).toBe(66.6);
  });
});

describe('consistencia', () => {
  it('no exige perfección para puntuar alto', () => {
    const c = consistencyScore({ proteinDays: 6, energyDays: 5, loggedDays: 7, trainings: 4, expectedTrainings: 4 });
    expect(c.value).toBeGreaterThanOrEqual(85);
    expect(c.label).toBe('Muy consistente');
  });
  it('pesa más la proteína y el registro que acertar la energía al detalle', () => {
    const proteina = consistencyScore({ proteinDays: 7, energyDays: 0, loggedDays: 7, trainings: 4, expectedTrainings: 4 });
    const energia = consistencyScore({ proteinDays: 0, energyDays: 7, loggedDays: 7, trainings: 4, expectedTrainings: 4 });
    expect(proteina.value).toBeGreaterThan(energia.value);
  });
});

describe('distribución de proteína', () => {
  function meal(time: string, protein: number, name: string): MealEntry {
    return {
      id: time, date: TODAY, slot: 'lunch', time, name, method: 'manual', createdAt: 0,
      items: [{ id: 'i', foodId: 'x', foodName: 'X', quantity: 1, unit: 'g', grams: 100,
        confidence: 'exact', nutrients: { ...EMPTY_NUTRIENTS, protein } }],
    };
  }

  it('avisa cuando la proteína se concentra en dos comidas', () => {
    const d = proteinDistribution(
      [meal('11:00', 12, 'Desayuno'), meal('14:00', 65, 'Comida'), meal('18:00', 5, 'Merienda'), meal('21:30', 48, 'Cena')],
      130,
    );
    expect(d.message).toMatch(/concentrada/i);
    expect(d.suggestion).toMatch(/no es obligatorio/i);
    expect(d.effectiveDoses).toBe(2);
  });

  it('no dice nada cuando está bien repartida', () => {
    const d = proteinDistribution(
      [meal('11:00', 32, 'Desayuno'), meal('14:00', 38, 'Comida'), meal('18:00', 28, 'Merienda'), meal('21:30', 34, 'Cena')],
      130,
    );
    expect(d.message).toBeNull();
    expect(d.effectiveDoses).toBe(4);
  });
});

describe('fechas', () => {
  it('la semana empieza en lunes', () => {
    expect(weekStart('2026-03-15')).toBe('2026-03-09'); // domingo → lunes anterior
    expect(weekStart('2026-03-09')).toBe('2026-03-09');
  });
  it('la fecha local no se desplaza por la zona horaria', () => {
    const d = new Date(2026, 2, 15, 23, 30);
    expect(toIsoDate(d)).toBe('2026-03-15');
  });
});
