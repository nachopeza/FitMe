import { useMemo } from 'react';
import { addDays, formatDayLabel, nowTime, toIsoDate } from '../../domain/dates';
import { behindMacro, closeTheGap, loggingStreak } from '../../domain/motivation';
import { scaleNutrients } from '../../domain/nutrition';
import { describeSession, sessionKcal } from '../../domain/training';
import { proteinDistribution } from '../../domain/trends';
import { MEAL_SLOTS, MEAL_SLOT_LABEL, type MealEntry, type MealSlot } from '../../domain/types';
import { entryNutrients, itemsNutrients } from '../../features/logging';
import { iconForText, quickAddItems, slotFromHour } from '../../features/quickAdd';
import { useApp } from '../../features/store';
import { Figure, MacroBar, Section, g } from '../components';
import { Icon } from '../icons';
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

        {/* Leyenda de lo cargado. El anillo ya dice cuánto; esto, de qué. */}
        <div className="load-legend">
          <span><i style={{ background: 'var(--m-protein)' }} />{g(consumed.protein)} g prot</span>
          <span><i style={{ background: 'var(--m-carbs)' }} />{g(consumed.carbs)} g carb</span>
          <span><i style={{ background: 'var(--m-fat)' }} />{g(consumed.fat)} g gras</span>
        </div>
        <div className="fuel-foot" style={{ marginTop: 10 }}>
          <span>{g(consumed.kcal)} de {g(targets.kcal.target)} kcal</span>
          {streak > 1 && (
            <span className="streak">
              <Icon name="flame" size={14} />{streak} días seguidos
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

      {/* ── Añadir de un toque: la razón de ser de esta pantalla ── */}
      <Section
        title="Añadir"
        action={
          <button className="link" onClick={() => ui.open({ k: 'addMenu' })}>Otra cosa</button>
        }
      >
        <div className="quick">
          {quick.map((item) => (
            <button
              className="quick-tile"
              key={item.key}
              data-macro={item.macro ?? undefined}
              onClick={() => void addQuick(item)}
            >
              <span className="quick-ico"><Icon name={item.icon} size={19} /></span>
              <span className="quick-name">{item.name}</span>
              <span className="quick-macros">
                {item.instant
                  ? <>{g(item.kcal)} kcal · <b>{g(item.protein)} g prot</b></>
                  : item.note ?? 'Elegir y añadir'}
              </span>
            </button>
          ))}
        </div>
        {app.savedMeals.length === 0 && basicFoods.length === 0 && (
          <p className="note tight" style={{ marginTop: 12 }}>
            Estas son genéricas todavía. Dile cuáles son <b>tus</b> básicos —tu plátano, tus frutos secos— y
            saldrán aquí para añadirlos de un toque.{' '}
            <button className="link" onClick={() => ui.open({ k: 'basics' })}>Elegir mis básicos</button>
          </p>
        )}
      </Section>

      {/* ── Qué comer, cuando no sabe qué ponerse ── */}
      <Section title="Si no sabes qué comer">
        <div className="btns">
          <button className="btn primary" onClick={() => ui.open({ k: 'suggest', mode: 'normal' })}>
            Dime qué comer
          </button>
          <button className="btn" onClick={() => ui.open({ k: 'suggest', mode: 'quick', title: 'Cena rápida' })}>
            Algo rápido
          </button>
        </div>
      </Section>

      {/* ── Macros, en segundo plano ── */}
      <Section title="Macros de hoy" action={<button className="link" onClick={() => ui.open({ k: 'macros' })}>Ver todo</button>}>
        <MacroBar macro="protein" value={consumed.protein} range={targets.protein} showRange={false} />
        <MacroBar macro="carbs" value={consumed.carbs} range={targets.carbs} showRange={false} />
        <MacroBar macro="fat" value={consumed.fat} range={targets.fat} showRange={false} />
      </Section>

      {/* ── Lo registrado ── */}
      <Section
        title="Hoy has comido"
        aside={entries.length ? `${entries.length} ${entries.length === 1 ? 'comida' : 'comidas'}` : undefined}
      >
        {entries.length === 0 ? (
          <div className="empty">
            <strong>Nada registrado todavía</strong>
            Toca cualquier cosa de arriba, o cuéntaselo por voz desde el botón de añadir.
          </div>
        ) : (
          MEAL_SLOTS.filter((s) => bySlot.has(s)).map((mealSlot) => {
            const list = bySlot.get(mealSlot)!;
            const slotKcal = list.reduce((a, e) => a + entryNutrients(e).kcal, 0);
            return (
              <div key={mealSlot} style={{ marginBottom: 18 }}>
                <div className="section-head" style={{ marginBottom: 8, paddingBottom: 6 }}>
                  <span className="section-title" style={{ fontSize: '0.85rem' }}>{MEAL_SLOT_LABEL[mealSlot]}</span>
                  <span className="section-aside">{g(slotKcal)} kcal</span>
                </div>
                <div className="rows">
                  {list.map((e) => {
                    const n = entryNutrients(e);
                    return (
                      <button className="row" key={e.id} onClick={() => ui.open({ k: 'entry', id: e.id })}>
                        <span className="row-time">{e.time}</span>
                        <div className="row-body">
                          <div className="row-name">
                            {e.name || e.items.map((i) => i.foodName.replace(/\([^)]*\)/g, '').trim()).join(' + ')}
                          </div>
                          <div className="row-meta">{g(n.protein)} g de proteína</div>
                        </div>
                        <div className="row-num">{g(n.kcal)}<small>kcal</small></div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </Section>

      {/* ── Contexto del día, al final: informa, no manda ── */}
      <Section title="El día" action={<button className="link" onClick={() => ui.open({ k: 'dayState' })}>Editar</button>}>
        <div className="figures">
          <button className="figure" onClick={() => ui.open({ k: 'workout' })}>
            <div className="figure-label">Entreno</div>
            <div className="figure-value text">
              {day?.training ? `${day.training.minutes} min` : 'Añadir'}
            </div>
            {day?.training && (
              <div className="figure-sub">
                ~{g(sessionKcal(app.weights.at(-1)?.kg ?? profile?.startWeightKg ?? 70, day.training))} kcal
              </div>
            )}
          </button>
          <Figure label="Pasos" value={day?.steps != null ? g(day.steps) : '—'} />
          <Figure label="Peso" value={app.weights.at(-1)?.kg ? `${app.weights.at(-1)!.kg} kg` : '—'}
            sub={app.weights.at(-1)?.date === app.date ? 'hoy' : 'última pesada'} />
        </div>
        {day?.deviceKcal != null && (
          <p className="note tight" style={{ marginTop: 12 }}>
            Tu reloj marca {g(day.deviceKcal)} kcal. Se guarda como una señal más, no se suma al objetivo: esas
            estimaciones se equivocan con facilidad en un 20 o 30%.
          </p>
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
