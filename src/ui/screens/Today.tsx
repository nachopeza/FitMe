import { useMemo } from 'react';
import { addDays, formatDayLabel, nowTime, toIsoDate } from '../../domain/dates';
import { behindMacro, closeTheGap, loggingStreak } from '../../domain/motivation';
import { scaleNutrients } from '../../domain/nutrition';
import { describeSession, sessionKcal } from '../../domain/training';
import { proteinDistribution } from '../../domain/trends';
import { eatenBySlot, mealTargets } from '../../domain/meals';
import { MEAL_SLOTS, type MealEntry, type MealSlot } from '../../domain/types';
import { entryNutrients, itemsNutrients } from '../../features/logging';
import { iconForText, quickAddItems, slotFromHour } from '../../features/quickAdd';
import { useApp } from '../../features/store';
import { Section, g } from '../components';
import { Icon } from '../icons';
import { DayTimeline, type DayNode } from './DayTimeline';
import { Ring } from '../Ring';
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

  const behind = behindMacro(consumed, {
    protein: targets.protein.target, carbs: targets.carbs.target, fat: targets.fat.target,
  });

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

  /** Registra una propuesta tal cual, repetida las veces que diga. */
  const addPlan = async (key: string, count: number, name: string) => {
    const [kind, id] = key.split(':');
    const ids: string[] = [];
    for (let i = 0; i < count; i++) {
      const entryId = kind === 'basic'
        ? await app.actions.logBasicFood(id)
        : await app.actions.logSavedMeal(id);
      if (entryId) ids.push(entryId);
    }
    if (ids.length) {
      ui.notify(`${count > 1 ? `${count} × ` : ''}${name}`, async () => {
        for (const entryId of ids) await app.actions.deleteEntry(entryId);
      });
    }
  };

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
      <header className="head">
        <div style={{ minWidth: 0 }}>
          <div className="head-date">{formatDayLabel(app.date)}</div>
          <div className="head-note">
            {day?.training ? describeSession(day.training) : 'Sin entrenamiento registrado'}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 2, flex: '0 0 auto' }}>
          <button className="icon-btn" aria-label="Día anterior" onClick={() => app.setDate(addDays(app.date, -1))}>
            <span style={{ transform: 'rotate(180deg)', display: 'grid' }}><Icon name="chevron" size={18} /></span>
          </button>
          {!app.isToday ? (
            <button className="btn sm auto quiet" onClick={() => app.setDate(toIsoDate())}>Hoy</button>
          ) : null}
          <button className="icon-btn" aria-label="Día siguiente" disabled={app.date >= toIsoDate()}
            onClick={() => app.setDate(addDays(app.date, 1))}>
            <Icon name="chevron" size={18} />
          </button>
        </div>
      </header>

      {/* ── El hueco: lo único grande de la pantalla ──
          El borde superior lleva el color del macro más atrasado, así que la
          tarjeta ya dice de qué va el día antes de leer un número. */}
      <div className="hero" style={{ ['--behind' as string]: `var(--m-${behind})` }}>
        <Ring
          target={targets.kcal.target}
          segments={[
            { key: 'protein', kcal: consumed.protein * 4 },
            { key: 'carbs', kcal: consumed.carbs * 4 },
            { key: 'fat', kcal: consumed.fat * 9 },
          ]}
        >
          {done ? (
            <>
              <span className="ring-label">Hoy ya has comido</span>
              <span className="ring-figure">{g(consumed.kcal)}</span>
              <span className="ring-unit">kcal · listo</span>
            </>
          ) : (
            <>
              <span className="ring-label">Te falta</span>
              <span className="ring-figure">{g(kcalLeft)}</span>
              <span className="ring-unit">kcal por comer</span>
              {proteinLeft > 0 && (
                <span className="ring-second">y <b>{g(proteinLeft)} g</b> de proteína</span>
              )}
            </>
          )}
        </Ring>

        {/* Macros bajo el anillo: cuánto de cada uno y cuánto queda, con su
            color de disco. El anillo dice cuánto llevas; esto, de qué. */}
        <div className="macro-mini">
          {([
            ['protein', 'Proteína', consumed.protein, targets.protein.target],
            ['carbs', 'Carbohidratos', consumed.carbs, targets.carbs.target],
            ['fat', 'Grasas', consumed.fat, targets.fat.target],
          ] as const).map(([key, label, value, target]) => (
            <div className="macro-mini-item" key={key}>
              <span className="macro-mini-name">{label}</span>
              <span className="macro-mini-bar">
                <span
                  style={{
                    width: `${Math.min(100, (value / Math.max(1, target)) * 100)}%`,
                    background: `var(--m-${key})`,
                  }}
                />
              </span>
              <span className="macro-mini-read">
                <b>{g(value)}</b> / {g(target)} g
              </span>
            </div>
          ))}
        </div>
        <div className="hero-foot">
          <button className="link" onClick={() => ui.open({ k: 'macros' })}>Rangos y fibra</button>
          {streak > 1 && (
            <span className="streak">
              <Icon name="flame" size={14} />{streak} días
            </span>
          )}
        </div>

        {/* Lo que de verdad mueve: el hueco traducido a comida suya, y tocable. */}
        {plan.length > 0 && (
          <div className="in-food">
            {kcalLeft > targets.kcal.target * 0.45
              ? 'Con lo que sueles comer, una comida para ir cerrándolo:'
              : 'Con lo que sueles comer, esto lo cierra:'}
            <div className="plan">
              {plan.map((p) => (
                <button className="plan-item" key={p.id} onClick={() => void addPlan(p.id, p.count, p.name)}>
                  <b>{p.count > 1 ? `${p.count} × ` : ''}{p.name}</b>
                  <span>{g(p.kcal * p.count)} kcal</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Añadir de un toque ──
          En carril horizontal, no en rejilla: una rejilla de cinco casillas se
          comía una pantalla entera para algo que son cuatro atajos. De paso, la
          dirección cambia y la pantalla deja de ser una columna de bloques. */}
      <Section
        title="Añadir"
        action={<button className="link" onClick={() => ui.open({ k: 'addMenu' })}>Otra cosa</button>}
      >
        <div className="rail">
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
          {/* El último del carril no es un alimento: es la salida para cuando no
              sabe qué comer, que antes era una sección suelta con dos botones. */}
          <button
            className="rail-card is-ask"
            onClick={() => ui.open({ k: 'suggest', mode: 'normal', title: '¿Qué como ahora?' })}
          >
            <span className="quick-ico"><Icon name="search" size={20} /></span>
            <span className="rail-name">No sé qué comer</span>
            <span className="rail-meta">Que te diga</span>
          </button>
        </div>
        {app.savedMeals.length === 0 && basicFoods.length === 0 && (
          <p className="note tight" style={{ marginTop: 12 }}>
            Estas son genéricas todavía. Dile cuáles son <b>tus</b> básicos —tu plátano, tus frutos secos— y
            saldrán aquí para añadirlos de un toque.{' '}
            <button className="link" onClick={() => ui.open({ k: 'basics' })}>Elegir mis básicos</button>
          </p>
        )}
      </Section>

      {/* ── El día, en una espina ──
          Antes aquí había tres secciones: las comidas con su objetivo, el
          registro de lo comido y el contexto del día. Las dos primeras
          enseñaban lo mismo dos veces. */}
      <Section
        title="Tu día"
        action={<button className="link" onClick={() => ui.open({ k: 'dayState' })}>Editar</button>}
      >
        <DayTimeline
          nodes={dayNodes}
          onAdd={(slot) => ui.open({ k: 'manual', slot })}
          onOpenEntry={(id) => ui.open({ k: 'entry', id })}
        />
        {day?.deviceKcal != null && (
          <p className="note tight" style={{ marginTop: 14 }}>
            Tu reloj marca {g(day.deviceKcal)} kcal. Se guarda como una señal más, no se suma al objetivo: esas
            estimaciones se equivocan con facilidad en un 20 o 30%.
          </p>
        )}
        {day?.steps != null && (
          <p className="note tight">Hoy llevas {g(day.steps)} pasos.</p>
        )}
      </Section>

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
