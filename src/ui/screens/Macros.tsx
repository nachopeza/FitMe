import { useMemo, useState } from 'react';
import { useApp } from '../../features/store';
import { entryNutrients, shareOfDay } from '../../features/logging';
import { formatDayLabel } from '../../domain/dates';
import { macroStatus, STATUS_DOT, STATUS_TEXT } from '../../domain/nutrition';
import { MACRO_KEYS, MEAL_SLOTS, MEAL_SLOT_LABEL, type MealEntry, type MealSlot } from '../../domain/types';
import { Card, MACRO_META, MacroBar, WhyButton, g } from '../components';
import { useUI } from '../shell';

export function MacrosScreen() {
  const app = useApp();
  const ui = useUI();
  const { entries, targets, consumed, remaining, settings } = app;
  const [showSecondary, setShowSecondary] = useState(settings.showSecondaryNutrients);

  const bySlot = useMemo(() => {
    const map = new Map<MealSlot, MealEntry[]>();
    for (const e of entries) {
      const list = map.get(e.slot);
      if (list) list.push(e);
      else map.set(e.slot, [e]);
    }
    return map;
  }, [entries]);

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h1>📊 Macros</h1>
          <div className="screen-sub">{formatDayLabel(app.date)}</div>
        </div>
        <button className="btn sm auto ghost" onClick={() => ui.open({ k: 'targets' })}>Objetivos</button>
      </header>

      {/* ── Objetivo diario, con rango y estado ── */}
      <Card title="Objetivo de hoy">
        {MACRO_KEYS.map((k) => (
          <MacroBar key={k} macro={k} value={consumed[k]} range={targets[k]} />
        ))}
        <div className="divider" />
        <WhyButton reasons={targets.rationale} label="¿Cómo se calculan mis objetivos?" />
      </Card>

      {/* ── Lo que queda ── */}
      <Card title="Te queda hoy" right={<button className="link-btn" onClick={() => ui.open({ k: 'suggest', mode: 'normal', title: 'Ajustar el día' })}>⚙️ Ajustar</button>}>
        <div className="grid-3">
          {MACRO_KEYS.map((k) => (
            <div className="stat" key={k}>
              <div className="stat-label">{MACRO_META[k].icon} {MACRO_META[k].short}</div>
              <div className="stat-value" style={{ color: remaining[k] < 0 ? 'var(--warn)' : undefined }}>
                {remaining[k] >= 0 ? '' : '+'}{g(Math.abs(remaining[k]))}
              </div>
            </div>
          ))}
        </div>
        <p className="note" style={{ marginTop: 10, marginBottom: 0 }}>
          Estos números son una guía, no una nota. Terminar el día 80 kcal arriba o abajo no cambia nada:
          lo que cuenta es la media de la semana.
        </p>
      </Card>

      {/* ── Resumen por comidas ── */}
      <Card title="Resumen por comidas">
        {entries.length === 0 ? (
          <div className="empty">
            <span className="ico" aria-hidden="true">📊</span>
            Sin comidas registradas hoy.
          </div>
        ) : (
          <>
            {MEAL_SLOTS.filter((s) => bySlot.has(s)).map((slot) => {
              const list = bySlot.get(slot)!;
              const n = list.reduce(
                (acc, e) => {
                  const x = entryNutrients(e);
                  return {
                    kcal: acc.kcal + x.kcal, protein: acc.protein + x.protein, carbs: acc.carbs + x.carbs,
                    fat: acc.fat + x.fat, fiber: acc.fiber + x.fiber,
                  };
                },
                { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0 },
              );
              return (
                <div key={slot} style={{ marginBottom: 13 }}>
                  <div className="card-title" style={{ marginBottom: 5 }}>
                    <span>{MEAL_SLOT_LABEL[slot]}</span>
                    <span className="tag info">{shareOfDay(n.kcal, targets.kcal.target)}% del día</span>
                  </div>
                  <div className="sugg-macros">
                    {MACRO_KEYS.map((k) => (
                      <span className="pill" key={k} style={{ color: MACRO_META[k].color }}>
                        {MACRO_META[k].icon} {g(n[k])}{k === 'kcal' ? '' : ' g'}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
            <div className="divider" />
            <div className="card-title" style={{ marginBottom: 5 }}><span>Total</span></div>
            <div className="sugg-macros">
              {MACRO_KEYS.map((k) => (
                <span className="pill" key={k} style={{ color: MACRO_META[k].color }}>
                  {MACRO_META[k].icon} {g(consumed[k])}{k === 'kcal' ? '' : ' g'}
                </span>
              ))}
            </div>
          </>
        )}
      </Card>

      {/* ── Nutrientes secundarios: presentes, pero sin dominar ── */}
      <Card
        title="Otros nutrientes"
        right={
          <button
            className="link-btn"
            onClick={() => {
              setShowSecondary((v) => !v);
              void app.actions.setSettings({ showSecondaryNutrients: !showSecondary });
            }}
          >
            {showSecondary ? 'Ocultar' : 'Mostrar'}
          </button>
        }
      >
        {showSecondary ? (
          <>
            <div className="grid-3">
              <div className="stat">
                <div className="stat-label">Saturadas</div>
                <div className="stat-value">{g(consumed.satFat ?? 0)} g</div>
                <div className="stat-sub">
                  {(consumed.satFat ?? 0) <= consumed.fat * 0.4 ? 'Reparto razonable' : 'Bastante del total'}
                </div>
              </div>
              <div className="stat">
                <div className="stat-label">Azúcares</div>
                <div className="stat-value">{g(consumed.sugars ?? 0)} g</div>
              </div>
              <div className="stat">
                <div className="stat-label">Sodio</div>
                <div className="stat-value">{g((consumed.sodium ?? 0) / 1000)} g</div>
              </div>
            </div>
            <p className="note" style={{ marginTop: 10, marginBottom: 0 }}>
              Se muestran como información, no como un límite que cumplir. Huevos, queso, carne y aceite de
              oliva forman parte de una alimentación normal y aportan saturadas: no hay nada que corregir por
              eso solo.
            </p>
          </>
        ) : (
          <p className="note" style={{ marginBottom: 0 }}>
            Saturadas, azúcares y sodio se registran siempre, pero quedan en segundo plano para no llenar la
            pantalla de números que no cambian tus decisiones.
          </p>
        )}
      </Card>

      {/* ── Estado global ── */}
      <Card title="Estado">
        <div className="list">
          {MACRO_KEYS.map((k) => {
            const st = macroStatus(consumed[k], targets[k]);
            return (
              <div className="row" key={k}>
                <div className="row-main">
                  <div className="row-title" style={{ fontSize: '0.88rem' }}>
                    {MACRO_META[k].icon} {MACRO_META[k].label}
                  </div>
                  <div className="row-sub">
                    Objetivo {g(targets[k].target)} · rango {g(targets[k].min)}–{g(targets[k].max)} {MACRO_META[k].unit}
                  </div>
                </div>
                <div className="row-side">{STATUS_DOT[st]} <span style={{ fontSize: '0.72rem' }}>{STATUS_TEXT[st]}</span></div>
              </div>
            );
          })}
        </div>
      </Card>
    </div>
  );
}
