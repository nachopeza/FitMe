import { useCallback, useMemo } from 'react';
import { addDays, formatDayLabel, nowTime, toIsoDate } from '../../domain/dates';
import { closeTheGap, loggingStreak } from '../../domain/motivation';
import { scaleNutrients } from '../../domain/nutrition';
import { describeSession, sessionKcal } from '../../domain/training';
import { proteinDistribution } from '../../domain/trends';
import { eatenBySlot, mealTargets } from '../../domain/meals';
import { MEAL_SLOTS, type FoodCategory, type MealEntry, type MealSlot } from '../../domain/types';
import { entryNutrients, itemsNutrients } from '../../features/logging';
import { iconForText, quickAddItems, slotFromHour } from '../../features/quickAdd';
import { useApp } from '../../features/store';
import { Section, g } from '../components';
import { Icon } from '../icons';
import { DayTimeline, type DayNode } from './DayTimeline';
import { FoodArt, TrendArt } from '../FoodArt';

/** Qué icono lleva el chip de cada macro, como en la referencia. */
const MACRO_ICON = { protein: 'dumbbell', carbs: 'wheat', fat: 'drop' } as const;
import { useUI } from '../shell';

/**
 * Pantalla de hoy.
 *
 * El protagonista es lo que FALTA por comer, dicho en una frase, porque el
 * problema de su dueño no es pasarse: es quedarse corto. Debajo, lo que come de
 * verdad a un toque de distancia. Todo lo demás baja de nivel.
 */
export function TodayScreen() {
  const app = useApp();
  const ui = useUI();
  const { entries, targets, consumed, remaining, day, profile } = app;

  const slot: MealSlot = slotFromHour(nowTime());

  /** Sus básicos, ya resueltos a la ración por defecto de cada alimento. */
  const basicFoods = useMemo(
    () => (profile?.basicFoodIds ?? []).flatMap((id) => {
      const food = app.foodsById.get(id);
      if (!food) return [];
      const portion = food.portions.find((p) => p.isDefault) ?? food.portions[0];
      const grams = portion?.grams ?? 100;
      return [{
        id: food.id,
        name: food.name,
        icon: iconForText(food.name),
        portionLabel: portion?.label ?? '100 g',
        nutrients: scaleNutrients(food.per100g, grams),
        useCount: 0,
      }];
    }),
    [profile?.basicFoodIds, app.foodsById],
  );

  const quick = useMemo(
    () =>
      quickAddItems({
        savedMeals: app.savedMeals,
        macrosOf: (meal) => itemsNutrients(meal.items),
        slot,
        limit: 6,
        basics: basicFoods,
      }),
    [app.savedMeals, slot, basicFoods],
  );

  const bySlot = useMemo(() => {
    const map = new Map<MealSlot, MealEntry[]>();
    for (const e of entries) {
      const list = map.get(e.slot);
      if (list) list.push(e);
      else map.set(e.slot, [e]);
    }
    return map;
  }, [entries]);

  const distribution = useMemo(
    () => proteinDistribution(entries, targets.protein.target),
    [entries, targets.protein.target],
  );

  /** Objetivo de cada comida, sobre las franjas que él usa de verdad. */
  const slotTargets = useMemo(() => {
    const times = profile?.mealTimes ?? {};
    const slots = MEAL_SLOTS.filter((sl) => sl !== 'extra' && times[sl]);
    return mealTargets(targets.kcal.target, targets.protein.target, slots.length ? slots : undefined);
  }, [profile?.mealTimes, targets.kcal.target, targets.protein.target]);

  const eaten = useMemo(
    () => eatenBySlot(entries.map((e) => ({ slot: e.slot, nutrients: entryNutrients(e) }))),
    [entries],
  );

  /**
   * Los momentos del día, en orden de reloj.
   *
   * Las comidas con su objetivo y lo que llevan dentro, más el entreno y la
   * pesada en su sitio. El estado de cada comida sale de la hora: lo que ya
   * pasó puede quedarse corto, lo que no ha llegado solo se atenúa.
   */
  const dayNodes = useMemo<DayNode[]>(() => {
    const now = nowTime();
    const times = profile?.mealTimes ?? {};
    const nodes: DayNode[] = [];

    for (const t of slotTargets) {
      const got = eaten.get(t.slot);
      const kcal = Math.round(got?.kcal ?? 0);
      const time = times[t.slot] ?? '--:--';
      const covered = t.kcal > 0 && kcal / t.kcal >= 0.85;
      const past = time <= now;
      // "Ahora" es la franja en curso: ya ha empezado y la siguiente no.
      const nextTime = slotTargets
        .map((x) => times[x.slot] ?? '23:59')
        .filter((x) => x > time)
        .sort()[0] ?? '23:59';
      const current = past && now < nextTime;
      nodes.push({
        type: 'meal',
        slot: t.slot,
        time,
        target: t,
        kcal,
        protein: Math.round(got?.protein ?? 0),
        entries: bySlot.get(t.slot) ?? [],
        state: covered ? 'done' : current ? 'now' : past ? 'behind' : 'ahead',
      });
    }

    if (day?.training) {
      nodes.push({
        type: 'event',
        key: 'training',
        time: profile?.trainingTime ?? '--:--',
        icon: 'dumbbell',
        title: describeSession(day.training),
        detail: `${day.training.minutes} min · ~${g(sessionKcal(
          app.weights.at(-1)?.kg ?? profile?.startWeightKg ?? 70, day.training,
        ))} kcal`,
        onOpen: () => ui.open({ k: 'workout' }),
      });
    }

    const weighIn = app.weights.find((w) => w.date === app.date);
    if (weighIn) {
      nodes.push({
        type: 'event',
        key: 'weight',
        time: weighIn.time ?? '--:--',
        icon: 'weight',
        title: `${weighIn.kg} kg`,
        detail: weighIn.conditions,
        onOpen: () => ui.open({ k: 'weight' }),
      });
    }

    return nodes.sort((a, b) => a.time.localeCompare(b.time));
  }, [slotTargets, eaten, bySlot, profile, day, app.weights, app.date, ui]);


  const kcalLeft = Math.max(0, Math.round(remaining.kcal));
  const proteinLeft = Math.max(0, Math.round(remaining.protein));
  const done = kcalLeft <= 60 && proteinLeft <= 5;


  const streak = useMemo(
    () => loggingStreak(app.daysWithFood, app.date),
    [app.daysWithFood, app.date],
  );

  /**
   * El hueco traducido a comida suya. Solo entra lo que él ya come: sus básicos
   * y sus comidas guardadas. Nunca algo del catálogo que no haya elegido.
   */
  const plan = useMemo(() => {
    if (done) return [];
    const candidates = [
      ...basicFoods.map((b) => ({
        id: `basic:${b.id}`, name: b.name, kcal: Math.round(b.nutrients.kcal), protein: b.nutrients.protein,
      })),
      ...app.savedMeals.map((m) => {
        const n = itemsNutrients(m.items);
        return { id: `saved:${m.id}`, name: m.name, kcal: Math.round(n.kcal), protein: n.protein };
      }),
    ];
    // Se propone UNA comida, no el día entero: a media mañana, ver lo que falta
    // por comer hasta la noche en una sola propuesta abruma en vez de empujar.
    const chunk = Math.round(targets.kcal.target * 0.4);
    return closeTheGap(Math.min(kcalLeft, chunk), proteinLeft, candidates, { maxEach: 2 });
  }, [app.savedMeals, basicFoods, kcalLeft, proteinLeft, done, targets.kcal.target]);

  /**
   * El dibujo que le toca a una comida: la categoría del alimento que más
   * calorías aporta. Es lo que mejor la representa de un vistazo.
   */
  const artOf = useCallback((entry: MealEntry) => {
    let best: { cat: FoodCategory; kcal: number } | null = null;
    for (const item of entry.items) {
      const food = app.foodsById.get(item.foodId);
      if (!food) continue;
      if (!best || item.nutrients.kcal > best.kcal) best = { cat: food.category, kcal: item.nutrients.kcal };
    }
    return <FoodArt category={best?.cat ?? 'other'} size={44} />;
  }, [app.foodsById]);

  const addQuick = async (item: (typeof quick)[number]) => {
    if (item.kind === 'composition') {
      ui.open({ k: 'composition', id: item.id });
      return;
    }
    if (item.kind === 'basic') {
      const entryId = await app.actions.logBasicFood(item.id);
      if (entryId) {
        ui.notify(`${item.name} · ${g(item.kcal)} kcal`, () => app.actions.deleteEntry(entryId));
      }
      return;
    }
    const entryId = await app.actions.logSavedMeal(item.id);
    if (entryId) {
      ui.notify(`${item.name} · ${g(item.kcal)} kcal`, () => app.actions.deleteEntry(entryId));
    }
  };

  return (
    <div className="screen">
      <header className="top rise">
        <div style={{ minWidth: 0 }}>
          <h1 className="screen-title">{app.isToday ? 'Hoy' : formatDayLabel(app.date)}</h1>
          <p className="screen-sub">
            {day?.training ? describeSession(day.training) : 'Registra tu día, paso a paso'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: 6, flex: '0 0 auto' }}>
          {!app.isToday && (
            <button className="top-round" aria-label="Volver a hoy" onClick={() => app.setDate(toIsoDate())}>
              <Icon name="today" size={19} />
            </button>
          )}
          <button className="top-round" aria-label="Abrir el calendario" onClick={() => ui.open({ k: 'calendar' })}>
            <Icon name="calendar" size={19} />
          </button>
        </div>
      </header>

      {/* Los días se cambian deslizando con estas flechas, no con la cabecera. */}
      <div className="daynav rise">
        <button className="top-round sm" aria-label="Día anterior" onClick={() => app.setDate(addDays(app.date, -1))}>
          <span style={{ transform: 'rotate(180deg)', display: 'grid' }}><Icon name="chevron" size={16} /></span>
        </button>
        <span>{formatDayLabel(app.date)}</span>
        <button className="top-round sm" aria-label="Día siguiente" disabled={app.date >= toIsoDate()}
          onClick={() => app.setDate(addDays(app.date, 1))}>
          <Icon name="chevron" size={16} />
        </button>
      </div>

      {/* ── El hueco: lo único grande de la pantalla ──
          El borde superior lleva el color del macro más atrasado, así que la
          tarjeta ya dice de qué va el día antes de leer un número. */}
      {/* ── Objetivo del día ──
          La tarjeta tintada de la referencia: lo que toca hoy, lo que queda y
          una barra gruesa. Es el primer golpe de vista. */}
      <div className="panel tint-mint rise objective">
        <span className="chip-ico c-kcal"><Icon name="target" size={21} /></span>
        <div className="objective-body">
          <div className="objective-label">Objetivo del día</div>
          <div className="objective-figure">{g(targets.kcal.target)} <span>kcal</span></div>
        </div>
        <div className="objective-left">
          <span>{done ? 'Completado' : 'Restan'}</span>
          <b>{done ? '¡Listo! 🎉' : `${g(kcalLeft)} kcal`}</b>
        </div>
        <div className="meter" style={{ gridColumn: '1 / -1', marginTop: 14 }}>
          <span style={{ width: `${Math.min(100, (consumed.kcal / Math.max(1, targets.kcal.target)) * 100)}%` }} />
        </div>
      </div>

      {/* ── Macros, en chips de color ── */}
      <div className="panel rise">
        <div className="macro-chips">
          {([
            ['protein', 'Proteína', consumed.protein, targets.protein.target, 'g'],
            ['carbs', 'Carbohidratos', consumed.carbs, targets.carbs.target, 'g'],
            ['fat', 'Grasas', consumed.fat, targets.fat.target, 'g'],
          ] as const).map(([key, label, value, target, unit]) => (
            <button className="macro-chip" key={key} onClick={() => ui.open({ k: 'macros' })}>
              <span className={`chip-ico sm c-${key}`}><Icon name={MACRO_ICON[key]} size={17} /></span>
              <span className="macro-chip-body">
                <span className="macro-chip-name">{label}</span>
                <span className="macro-chip-value">{g(value)} <small>/ {g(target)} {unit}</small></span>
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* ── Comidas ── */}
      <div className="panel rise">
        <div className="panel-head">
          <span className="chip-ico sm c-kcal"><Icon name="plate" size={17} /></span>
          <h3>Comidas</h3>
          <button className="panel-link" onClick={() => ui.open({ k: 'addMenu' })}>
            Ver todo <Icon name="chevron" size={15} />
          </button>
        </div>

        <DayTimeline
          nodes={dayNodes}
          onAdd={(slot) => ui.open({ k: 'manual', slot })}
          onOpenEntry={(id) => ui.open({ k: 'entry', id })}
          artOf={artOf}
        />

        <div className="rail" style={{ marginTop: 14 }}>
          {quick.map((item) => (
            <button
              className="rail-card"
              key={item.key}
              data-macro={item.macro ?? undefined}
              onClick={() => void addQuick(item)}
            >
              <span className="quick-ico"><Icon name={item.icon} size={20} /></span>
              <span className="rail-name">{item.name}</span>
              <span className="rail-meta">
                {item.instant ? `${g(item.kcal)} kcal` : item.note ?? 'Elegir'}
              </span>
            </button>
          ))}
          <button
            className="rail-card is-ask"
            onClick={() => ui.open({ k: 'suggest', mode: 'normal', title: '¿Qué como ahora?' })}
          >
            <span className="quick-ico"><Icon name="search" size={20} /></span>
            <span className="rail-name">No sé qué comer</span>
            <span className="rail-meta">Que te diga</span>
          </button>
        </div>

        <button className="btn-outline" onClick={() => ui.open({ k: 'addMenu' })}>
          <Icon name="plus" size={17} /> Añadir comida
        </button>
      </div>

      {/* ── Entrenamiento ── */}
      <div className="panel rise">
        <div className="panel-head">
          <span className="chip-ico sm c-protein"><Icon name="dumbbell" size={17} /></span>
          <h3>Entrenamiento</h3>
          <button className="panel-link" onClick={() => ui.setTab('workout')}>
            Ver rutinas <Icon name="chevron" size={15} />
          </button>
        </div>
        <button className="go-row" onClick={() => ui.setTab('workout')}>
          <span className="go-play"><Icon name="play" size={18} /></span>
          <span className="go-body">
            <span className="go-title">
              {day?.training ? describeSession(day.training) : 'Empezar un entreno'}
            </span>
            <span className="go-meta">
              {day?.training
                ? `${day.training.minutes} min · ~${g(sessionKcal(
                  app.weights.at(-1)?.kg ?? profile?.startWeightKg ?? 70, day.training,
                ))} kcal`
                : 'Elige una rutina o empieza vacío'}
            </span>
          </span>
          <Icon name="chevron" size={18} />
        </button>
      </div>

      {/* ── ¿Cómo vas? ── */}
      <div className="panel tint-cream rise cheer">
        <div style={{ minWidth: 0 }}>
          <div className="cheer-title">¿Cómo vas? 📊</div>
          <p className="cheer-msg">
            {done
              ? 'Día cerrado. Mañana, otra vez 💪'
              : plan.length
                ? `Con lo que sueles comer, ${plan[0].count > 1 ? `${plan[0].count} × ` : ''}${plan[0].name} te acerca bastante.`
                : streak > 1
                  ? `${streak} días seguidos registrando. Mantén el ritmo 💪`
                  : 'Registra lo que comas y verás el hueco cerrarse.'}
          </p>
        </div>
        <TrendArt />
      </div>

      {/* ── Reparto de proteína, solo si hay algo que decir ── */}
      {distribution.message && (
        <Section title="Reparto de proteína">
          <p className="note">{distribution.message}</p>
          {distribution.suggestion && <p className="note">{distribution.suggestion}</p>}
        </Section>
      )}
    </div>
  );
}
