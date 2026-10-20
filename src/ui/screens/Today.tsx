import { useMemo } from 'react';
import { addDays, formatDayLabel, nowTime, toIsoDate } from '../../domain/dates';
import { describeSession, sessionKcal } from '../../domain/training';
import { proteinDistribution } from '../../domain/trends';
import { MEAL_SLOTS, MEAL_SLOT_LABEL, type MealEntry, type MealSlot } from '../../domain/types';
import { entryNutrients } from '../../features/logging';
import { quickAddItems, slotFromHour } from '../../features/quickAdd';
import { useApp } from '../../features/store';
import { Figure, MacroBar, Section, g } from '../components';
import { Icon } from '../icons';
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

  const quick = useMemo(
    () =>
      quickAddItems({
        savedMeals: app.savedMeals,
        macrosOf: (meal) =>
          meal.items.reduce(
            (a, i) => ({ kcal: a.kcal + i.nutrients.kcal, protein: a.protein + i.nutrients.protein }),
            { kcal: 0, protein: 0 },
          ),
        slot,
        limit: 6,
      }),
    [app.savedMeals, slot],
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
  const fuelPct = Math.min(100, (consumed.kcal / Math.max(1, targets.kcal.target)) * 100);

  const addQuick = async (item: (typeof quick)[number]) => {
    if (item.kind === 'composition') {
      ui.open({ k: 'composition', id: item.id });
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

      {/* ── El hueco: lo único grande de la pantalla ── */}
      <div className="gap">
        {done ? (
          <>
            <div className="gap-label">Hoy ya has comido lo que necesitabas</div>
            <div className="gap-done">{g(consumed.kcal)} kcal · {g(consumed.protein)} g de proteína</div>
          </>
        ) : (
          <>
            <div className="gap-label">Te falta por comer</div>
            <span className="gap-figure">
              {g(kcalLeft)}<span className="gap-unit">kcal</span>
            </span>
            {proteinLeft > 0 && (
              <div className="gap-second">
                y <b>{g(proteinLeft)} g</b> de proteína
              </div>
            )}
          </>
        )}

        <div className="fuel">
          <span className="fuel-fill" style={{ width: `${fuelPct}%` }} />
        </div>
        <div className="fuel-foot">
          <span>{g(consumed.kcal)} de {g(targets.kcal.target)} kcal</span>
          <span>{Math.round(fuelPct)}%</span>
        </div>
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
            <button className="quick-tile" key={item.key} onClick={() => void addQuick(item)}>
              <span style={{ color: 'var(--accent)', display: 'grid' }}>
                <Icon name={item.icon} size={19} />
              </span>
              <span className="quick-name">{item.name}</span>
              <span className="quick-macros">
                {item.instant
                  ? `${g(item.kcal)} kcal · ${g(item.protein)} g prot`
                  : item.note ?? 'Elegir y añadir'}
              </span>
            </button>
          ))}
        </div>
        {app.savedMeals.length === 0 && (
          <p className="note tight" style={{ marginTop: 12 }}>
            Según vayas registrando, aquí aparecerá lo que comes de verdad y bastará un toque. Empieza por tu
            café: se queda guardado tal y como lo tomas.
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
