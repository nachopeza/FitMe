import { useMemo } from 'react';
import { formatDayLabel } from '../../domain/dates';
import { STATUS_TEXT, macroStatus } from '../../domain/nutrition';
import { MACRO_KEYS, MEAL_SLOTS, MEAL_SLOT_LABEL, type MealEntry, type MealSlot } from '../../domain/types';
import { entryNutrients, shareOfDay } from '../../features/logging';
import { useApp } from '../../features/store';
import { Figure, MACRO_META, MacroBar, Section, Sheet, WhyButton, g } from '../components';
import { useUI } from '../shell';

/**
 * Detalle de macros del día.
 *
 * Vive en una hoja y no en una pestaña: el día a día se resuelve en Hoy, y
 * obligar a ir a otra pestaña para ver el detalle era una pestaña de más en una
 * app que tenía que simplificarse.
 */
export function MacrosSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const ui = useUI();
  const { entries, targets, consumed, remaining } = app;

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
    <Sheet title="Macros" subtitle={formatDayLabel(app.date)} onClose={onClose}>
      {/* ── Objetivo con rangos ── */}
      {MACRO_KEYS.map((k) => (
        <MacroBar key={k} macro={k} value={consumed[k]} range={targets[k]} />
      ))}

      <div style={{ marginTop: 16 }}>
        <WhyButton reasons={targets.rationale} label="¿De dónde salen estos números?" />
      </div>

      {/* ── Lo que queda ── */}
      <Section
        title="Te queda"
        action={<button className="link" onClick={() => { onClose(); ui.open({ k: 'suggest', mode: 'normal' }); }}>Qué comer</button>}
      >
        <div className="figures">
          {MACRO_KEYS.map((k) => (
            <Figure
              key={k}
              label={MACRO_META[k].label}
              value={`${remaining[k] >= 0 ? '' : '+'}${g(Math.abs(remaining[k]))}`}
              sub={remaining[k] >= 0 ? 'por tomar' : 'por encima'}
            />
          ))}
        </div>
        <p className="note tight" style={{ marginTop: 14 }}>
          Son una guía, no una nota. Terminar el día ochenta calorías arriba o abajo no cambia nada: lo que
          cuenta es la media de la semana.
        </p>
      </Section>

      {/* ── Por comidas ── */}
      <Section title="Por comidas">
        {entries.length === 0 ? (
          <div className="empty">Sin comidas registradas hoy.</div>
        ) : (
          MEAL_SLOTS.filter((s) => bySlot.has(s)).map((slot) => {
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
              <div key={slot} style={{ marginBottom: 16 }}>
                <div className="section-head" style={{ marginBottom: 8, paddingBottom: 6 }}>
                  <span className="section-title" style={{ fontSize: '0.85rem' }}>{MEAL_SLOT_LABEL[slot]}</span>
                  <span className="section-aside">{shareOfDay(n.kcal, targets.kcal.target)}% del día</span>
                </div>
                <div className="pills">
                  {MACRO_KEYS.map((k) => (
                    <span className={`pill${k === 'kcal' || k === 'protein' ? ' lead' : ''}`} key={k}>
                      {g(n[k])}{k === 'kcal' ? ' kcal' : ' g'} {MACRO_META[k].short}
                    </span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </Section>

      {/* ── Estado ── */}
      <Section title="Estado">
        <div className="rows">
          {MACRO_KEYS.map((k) => {
            const st = macroStatus(consumed[k], targets[k]);
            return (
              <div className="row" key={k}>
                <div className="row-body">
                  <div className="row-name">{MACRO_META[k].label}</div>
                  <div className="row-meta">
                    Objetivo {g(targets[k].target)}, rango {g(targets[k].min)}–{g(targets[k].max)} {MACRO_META[k].unit}
                  </div>
                </div>
                <span className={`tag${st === 'inRange' ? ' go' : st === 'over' ? ' over' : ''}`}>
                  {STATUS_TEXT[st]}
                </span>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Nutrientes secundarios ── */}
      <Section title="Otros nutrientes">
        <div className="figures">
          <Figure label="Saturadas" value={`${g(consumed.satFat ?? 0)} g`} />
          <Figure label="Azúcares" value={`${g(consumed.sugars ?? 0)} g`} />
          <Figure label="Sal" value={`${((consumed.sodium ?? 0) / 400).toFixed(1)} g`} />
        </div>
        <p className="note tight" style={{ marginTop: 12 }}>
          Se registran, pero quedan en segundo plano. Huevos, queso, carne y aceite de oliva aportan saturadas y
          forman parte de una alimentación normal: no hay nada que corregir solo por eso.
        </p>
      </Section>

      <button className="btn quiet sm" style={{ marginTop: 18 }}
        onClick={() => { onClose(); ui.open({ k: 'targets' }); }}>
        Editar mis objetivos a mano
      </button>
    </Sheet>
  );
}
