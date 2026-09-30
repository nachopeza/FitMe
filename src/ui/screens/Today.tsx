import { useMemo } from 'react';
import { useApp } from '../../features/store';
import { entryNutrients, shareOfDay } from '../../features/logging';
import { addDays, formatDayLabel, timeToMinutes, toIsoDate } from '../../domain/dates';
import { DAY_TYPE_LABEL, MEAL_SLOTS, MEAL_SLOT_LABEL, type Hunger, type Digestion, type MealEntry, type MealSlot } from '../../domain/types';
import { proteinDistribution } from '../../domain/trends';
import { Card, KcalRing, MACRO_META, MacroBar, MacroPills, WhyButton, g } from '../components';
import { useUI } from '../shell';

const HUNGER_LABEL: Record<Hunger, string> = {
  high: '😋 Mucha',
  normal: '🙂 Normal',
  low: '😐 Poca',
  veryLow: '🤢 Muy poco apetito',
};

const DIGESTION_LABEL: Record<Digestion, string> = {
  good: '🟢 Bien',
  bloated: '🟡 Hinchado',
  bad: '🔴 Muy incómodo',
};

export function TodayScreen() {
  const app = useApp();
  const ui = useUI();
  const { entries, targets, consumed, remaining, day, dayType, profile } = app;

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

  const trained = !!day?.training;
  const hour = timeToMinutes(new Date().toTimeString().slice(0, 5));
  const isEvening = hour >= 19 * 60;

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h1>{formatDayLabel(app.date)}</h1>
          <div className="screen-sub">{DAY_TYPE_LABEL[dayType]}</div>
        </div>
        <div style={{ display: 'flex', gap: 4 }}>
          <button className="icon-btn" aria-label="Día anterior" onClick={() => app.setDate(addDays(app.date, -1))}>‹</button>
          {!app.isToday && (
            <button className="btn sm auto ghost" onClick={() => app.setDate(toIsoDate())}>Hoy</button>
          )}
          <button
            className="icon-btn"
            aria-label="Día siguiente"
            disabled={app.date >= toIsoDate()}
            onClick={() => app.setDate(addDays(app.date, 1))}
          >›</button>
        </div>
      </header>

      {/* ── Estado energético del día ── */}
      <Card>
        <div className="ring-wrap">
          <KcalRing value={consumed.kcal} range={targets.kcal} />
          <div className="ring-side">
            <MacroBar macro="protein" value={consumed.protein} range={targets.protein} showRange={false} />
            <MacroBar macro="carbs" value={consumed.carbs} range={targets.carbs} showRange={false} />
            <MacroBar macro="fat" value={consumed.fat} range={targets.fat} showRange={false} />
            <MacroBar macro="fiber" value={consumed.fiber} range={targets.fiber} showRange={false} />
          </div>
        </div>
        {dayType !== 'rest' || trained ? (
          <div style={{ marginTop: 10 }}>
            <WhyButton reasons={targets.rationale.slice(0, 3)} label="¿De dónde salen estos objetivos?" />
          </div>
        ) : null}
      </Card>

      {/* ── Contexto del día ── */}
      <Card title="Contexto de hoy" right={<button className="link-btn" onClick={() => ui.open({ k: 'dayState' })}>Editar</button>}>
        <div className="grid-2">
          <button className="stat" style={{ textAlign: 'left' }} onClick={() => ui.open({ k: 'training' })}>
            <div className="stat-label">🏋️ Entrenamiento</div>
            <div className="stat-value" style={{ fontSize: '0.92rem' }}>
              {day?.training ? day.training.focus || 'Completado' : 'Sin registrar'}
            </div>
            {day?.training && <div className="stat-sub">{day.training.minutes} min · {day.training.exercises.length} ejercicios</div>}
          </button>
          <button className="stat" style={{ textAlign: 'left' }} onClick={() => ui.open({ k: 'dayState' })}>
            <div className="stat-label">🚶 Pasos</div>
            <div className="stat-value">{day?.steps != null ? g(day.steps) : '—'}</div>
            {day?.steps != null && profile && (
              <div className="stat-sub">
                {day.steps >= profile.typicalSteps ? 'Por encima de tu media' : 'Por debajo de tu media'}
              </div>
            )}
          </button>
          <button className="stat" style={{ textAlign: 'left' }} onClick={() => ui.open({ k: 'dayState' })}>
            <div className="stat-label">😋 Hambre</div>
            <div className="stat-value" style={{ fontSize: '0.92rem' }}>
              {day?.hunger ? HUNGER_LABEL[day.hunger] : 'Sin registrar'}
            </div>
          </button>
          <button className="stat" style={{ textAlign: 'left' }} onClick={() => ui.open({ k: 'dayState' })}>
            <div className="stat-label">🙂 Digestión</div>
            <div className="stat-value" style={{ fontSize: '0.92rem' }}>
              {day?.digestion ? DIGESTION_LABEL[day.digestion] : 'Sin registrar'}
            </div>
          </button>
        </div>
        {day?.deviceKcal != null && (
          <p className="note" style={{ marginTop: 10, marginBottom: 0 }}>
            Tu reloj marca {g(day.deviceKcal)} kcal. Las calorías estimadas por dispositivos tienen bastante
            incertidumbre: las usamos como una señal más, no como una medición exacta, y no se suman
            automáticamente a tu objetivo.
          </p>
        )}
      </Card>

      {/* ── Te queda hoy ── */}
      <Card title="Te queda hoy">
        <div className="grid-3">
          {(['kcal', 'protein', 'carbs'] as const).map((k) => (
            <div className="stat" key={k}>
              <div className="stat-label">{MACRO_META[k].icon} {MACRO_META[k].short}</div>
              <div className="stat-value" style={{ color: remaining[k] < 0 ? 'var(--warn)' : undefined }}>
                {remaining[k] >= 0 ? '' : '+'}{g(Math.abs(remaining[k]))}
              </div>
              <div className="stat-sub">{remaining[k] >= 0 ? 'por tomar' : 'por encima'}</div>
            </div>
          ))}
          {(['fat', 'fiber'] as const).map((k) => (
            <div className="stat" key={k}>
              <div className="stat-label">{MACRO_META[k].icon} {MACRO_META[k].short}</div>
              <div className="stat-value" style={{ color: remaining[k] < 0 ? 'var(--warn)' : undefined }}>
                {remaining[k] >= 0 ? '' : '+'}{g(Math.abs(remaining[k]))}
              </div>
              <div className="stat-sub">{remaining[k] >= 0 ? 'por tomar' : 'por encima'}</div>
            </div>
          ))}
          <button className="stat" style={{ textAlign: 'left', borderColor: 'var(--accent)' }} onClick={() => ui.open({ k: 'suggest', mode: 'normal', title: 'Ajustar el día' })}>
            <div className="stat-label">⚙️ Ajustar</div>
            <div className="stat-sub" style={{ marginTop: 4 }}>Cómo cerrar el día dentro de tus rangos</div>
          </button>
        </div>
      </Card>

      {/* ── Acciones principales ── */}
      <div className="btn-row">
        <button className="btn primary" onClick={() => ui.open({ k: 'suggest', mode: 'normal' })}>
          🍽️ ¿Qué como ahora?
        </button>
        <button className="btn" onClick={() => ui.open({ k: 'suggest', mode: 'quick', title: 'Cena rápida' })}>
          ⚡ Cena rápida
        </button>
      </div>
      <div className="btn-row">
        <button className="btn" onClick={() => ui.open({ k: 'voice' })}>🎤 Registrar</button>
        <button className="btn" onClick={() => ui.open({ k: 'photo' })}>📸 Analizar plato</button>
      </div>
      {isEvening && trained && (
        <p className="note" style={{ marginTop: 2, marginBottom: 14 }}>
          Has entrenado y es tarde. Si no tienes mucha hambre, «Cena rápida» te propone algo pequeño pero
          suficiente en lugar de un plato enorme.
        </p>
      )}

      {/* ── Comidas del día ── */}
      <Card title={`Comidas · ${entries.length}`} right={<button className="link-btn" onClick={() => ui.open({ k: 'addMenu' })}>Añadir</button>}>
        {entries.length === 0 ? (
          <div className="empty">
            <span className="ico" aria-hidden="true">🍽️</span>
            Todavía no has registrado nada.
            <br />
            Puedes dictarlo con el micrófono, hacer una foto o escribirlo.
          </div>
        ) : (
          MEAL_SLOTS.filter((s) => bySlot.has(s)).map((slot) => {
            const list = bySlot.get(slot)!;
            const slotTotal = list.reduce(
              (acc, e) => {
                const n = entryNutrients(e);
                return {
                  kcal: acc.kcal + n.kcal, protein: acc.protein + n.protein,
                  carbs: acc.carbs + n.carbs, fat: acc.fat + n.fat, fiber: acc.fiber + n.fiber,
                };
              },
              { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
            );
            return (
              <div key={slot} style={{ marginBottom: 14 }}>
                <div className="card-title" style={{ marginBottom: 6 }}>
                  <span>{MEAL_SLOT_LABEL[slot]}</span>
                  <span style={{ fontFamily: 'var(--fm)', textTransform: 'none', letterSpacing: 0 }}>
                    {g(slotTotal.kcal)} kcal · {g(slotTotal.protein)} g prot
                  </span>
                </div>
                <div className="list">
                  {list.map((e) => {
                    const n = entryNutrients(e);
                    return (
                      <button className="row" key={e.id} onClick={() => ui.open({ k: 'entry', id: e.id })}>
                        <div className="row-main">
                          <div className="row-title">
                            {e.name || e.items.map((i) => i.foodName.replace(/\([^)]*\)/g, '').trim()).join(' + ')}
                          </div>
                          <div className="row-sub">
                            {e.time} · {g(n.protein)} g prot · {g(n.carbs)} g carb · {g(n.fat)} g gras
                            {' · '}
                            {shareOfDay(n.kcal, targets.kcal.target)}% del día
                          </div>
                        </div>
                        <div className="row-side">{g(n.kcal)}<br /><span style={{ color: 'var(--text-faint)', fontSize: '0.7rem' }}>kcal</span></div>
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })
        )}
      </Card>

      {/* ── Reparto de proteína ── */}
      {distribution.message && (
        <Card title="Reparto de proteína">
          <p className="note" style={{ marginBottom: 6 }}>{distribution.message}</p>
          {distribution.suggestion && <p className="note" style={{ marginBottom: 10 }}>{distribution.suggestion}</p>}
          <div className="list">
            {distribution.bySlot.map((s, i) => (
              <div className="row" key={i}>
                <div className="row-main">
                  <div className="row-title" style={{ fontSize: '0.85rem' }}>{s.slot}</div>
                  <div className="row-sub">{s.time}</div>
                </div>
                <div className="row-side">{s.grams} g</div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {entries.length > 0 && (
        <Card title="Total del día">
          <MacroPills n={consumed} />
          <div className="note">
            {consumed.protein >= targets.protein.min
              ? 'La proteína del día está dentro de tu rango. Es el dato que más condiciona tu objetivo.'
              : `Te faltan unos ${g(Math.max(0, targets.protein.min - consumed.protein))} g de proteína para entrar en tu rango.`}
          </div>
        </Card>
      )}
    </div>
  );
}
