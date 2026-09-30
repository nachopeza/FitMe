import { useMemo, useState } from 'react';
import { deleteAllData } from '../../data/db';
import { formatDayLabel, lastNDays } from '../../domain/dates';
import { computeTargets, profileAge } from '../../domain/nutrition';
import { nutrientsForEntries, groupEntriesByDate } from '../../domain/trends';
import { MACRO_KEYS, MEAL_SLOT_LABEL, type MacroKey, type MacroTargets } from '../../domain/types';
import { Card, EstimateNotice, Field, MACRO_META, MacroPills, NumberInput, Sheet, g } from '../../ui/components';
import { useUI } from '../../ui/shell';
import { useApp } from '../store';
import { CONFIDENCE_LABEL, entryNutrients, shareOfDay } from '../logging';
import { DEFAULT_AI_MODEL, describeAiError, testApiKey } from '../capture/aiClient';

// ───────────────────────────── Detalle de una comida ─────────────────────────────

export function EntrySheet({ id, onClose }: { id: string; onClose: () => void }) {
  const app = useApp();
  const ui = useUI();
  const entry = app.entries.find((e) => e.id === id);
  if (!entry) return <Sheet title="Comida" onClose={onClose}><p className="note">Ya no existe.</p></Sheet>;
  const n = entryNutrients(entry);

  return (
    <Sheet
      title={entry.name || MEAL_SLOT_LABEL[entry.slot]}
      subtitle={`${entry.time} · ${METHOD_LABEL[entry.method]}`}
      onClose={onClose}
      footer={
        <div className="btn-row">
          <button className="btn danger" onClick={async () => {
            await app.actions.deleteEntry(entry.id);
            ui.notify('Comida borrada.');
            onClose();
          }}>Borrar</button>
          <button className="btn" onClick={async () => {
            await app.actions.upsertSavedMeal({
              id: `sm-${Date.now().toString(36)}`,
              name: entry.name || entry.items.map((i) => i.foodName.replace(/\([^)]*\)/g, '').trim()).slice(0, 3).join(' + '),
              items: entry.items.map(({ id: _id, ...rest }) => rest),
              slotHint: entry.slot,
              prepMinutes: 10,
              useCount: 1,
              createdAt: Date.now(),
            });
            ui.notify('Guardada como comida habitual.');
          }}>⭐ Guardar como habitual</button>
        </div>
      }
    >
      <MacroPills n={n} />
      <p className="note">
        Esta comida es el {shareOfDay(n.kcal, app.targets.kcal.target)}% de tus calorías del día y el{' '}
        {shareOfDay(n.protein, app.targets.protein.target)}% de tu proteína.
      </p>

      {entry.sourceNote && (
        <div className="card tight">
          <div className="card-title"><span>Registro original</span></div>
          <p className="note" style={{ marginBottom: 0, fontStyle: 'italic' }}>«{entry.sourceNote}»</p>
        </div>
      )}

      <div className="card tight">
        <div className="card-title"><span>Alimentos</span></div>
        <div className="list">
          {entry.items.map((i) => (
            <button className="row" key={i.id} onClick={() => { onClose(); ui.open({ k: 'food', id: i.foodId }); }}>
              <div className="row-main">
                <div className="row-title">{i.foodName}</div>
                <div className="row-sub">
                  {Math.round(i.grams)} g
                  {i.confidence !== 'exact' && <span className="tag warn" style={{ marginLeft: 6 }}>≈ {CONFIDENCE_LABEL[i.confidence]}</span>}
                </div>
              </div>
              <div className="row-side">{g(i.nutrients.kcal)} kcal<br />
                <span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>{g(i.nutrients.protein)} g prot</span>
              </div>
            </button>
          ))}
        </div>
      </div>
    </Sheet>
  );
}

const METHOD_LABEL: Record<string, string> = {
  manual: 'escrito a mano', voice: 'por voz', photo: 'por foto', barcode: 'código de barras',
  saved: 'comida guardada', recipe: 'receta', label: 'etiqueta',
};

// ───────────────────────────── Ficha de alimento ─────────────────────────────

export function FoodSheet({ id, onClose }: { id: string; onClose: () => void }) {
  const app = useApp();
  const ui = useUI();
  const food = app.foodsById.get(id);
  if (!food) return <Sheet title="Alimento" onClose={onClose}><p className="note">No encontrado.</p></Sheet>;
  const disliked = app.profile?.dislikes.includes(id) ?? false;

  return (
    <Sheet title={food.name} subtitle={food.brand} onClose={onClose}>
      <MacroPills n={food.per100g} />
      <p className="note">Valores por 100 {food.unit}.</p>

      <div className="card tight">
        <div className="card-title"><span>Raciones</span></div>
        <div className="list">
          {food.portions.map((p) => (
            <div className="row" key={p.label}>
              <div className="row-main"><div className="row-title" style={{ fontSize: '0.88rem' }}>{p.label}</div></div>
              <div className="row-side">{p.grams} {food.unit}</div>
            </div>
          ))}
        </div>
      </div>

      {food.counterpartId && (
        <div className="card tight">
          <div className="card-title"><span>Ojo con el estado</span></div>
          <p className="note" style={{ marginBottom: 8 }}>
            Existe también <b>{app.foodsById.get(food.counterpartId)?.name}</b>, que no es lo mismo.
            {food.cookedYield && ` 100 ${food.unit} de este rinden unos ${Math.round(100 * food.cookedYield)} ${food.unit} del otro.`}
          </p>
          <button className="btn sm ghost" onClick={() => ui.open({ k: 'food', id: food.counterpartId! })}>
            Ver {app.foodsById.get(food.counterpartId)?.name}
          </button>
        </div>
      )}

      <div className="btn-row">
        <button className="btn" onClick={() => { onClose(); ui.open({ k: 'compare' }); }}>⚖️ Comparar</button>
        <button className="btn" aria-pressed={disliked} onClick={async () => {
          const p = app.profile;
          if (!p) return;
          await app.actions.saveProfile({
            ...p,
            dislikes: disliked ? p.dislikes.filter((d) => d !== id) : [...p.dislikes, id],
          });
          ui.notify(disliked ? 'Volverá a proponerse.' : 'No se volverá a proponer.');
        }}>
          {disliked ? '↩️ Volver a proponer' : '🚫 No proponer'}
        </button>
      </div>
    </Sheet>
  );
}

// ───────────────────────────── Objetivos manuales ─────────────────────────────

export function TargetsSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const ui = useUI();
  const p = app.profile;
  const [t, setT] = useState<MacroTargets>(app.baseTargets);

  if (!p) return <Sheet title="Objetivos" onClose={onClose}><p className="note">Cargando…</p></Sheet>;

  const setMacro = (k: MacroKey, field: 'target' | 'min' | 'max', v: number | '') =>
    setT((prev) => ({ ...prev, [k]: { ...prev[k], [field]: v === '' ? 0 : v } }));

  /** Al cambiar el objetivo, el rango se reajusta solo si el usuario no lo ha tocado. */
  const setTargetWithRange = (k: MacroKey, v: number | '') => {
    if (v === '') return;
    const spread = { kcal: 0.07, protein: 0.12, carbs: 0.15, fat: 0.2, fiber: 0.35 }[k];
    setT((prev) => ({
      ...prev,
      [k]: { target: v, min: Math.round(v * (1 - spread)), max: Math.round(v * (1 + spread)) },
      origin: 'manual',
    }));
  };

  const macroSum = t.protein.target * 4 + t.carbs.target * 4 + t.fat.target * 9;
  const drift = Math.abs(macroSum - t.kcal.target);

  return (
    <Sheet
      title="Objetivos nutricionales"
      subtitle="Puedes fijarlos a mano"
      onClose={onClose}
      footer={
        <div className="btn-row">
          <button className="btn ghost" onClick={async () => {
            // Vuelve al cálculo automático descartando el ajuste manual.
            await app.actions.saveProfile({ ...p, manualKcalOffset: 0 });
            await app.actions.recomputeTargets({ ...p, manualKcalOffset: 0 });
            ui.notify('Objetivos recalculados a partir de tus datos.');
            onClose();
          }}>Recalcular</button>
          <button className="btn primary" onClick={async () => {
            await app.actions.saveProfile({ ...p, targets: { ...t, origin: 'manual' } });
            ui.notify('Objetivos guardados.');
            onClose();
          }}>Guardar</button>
        </div>
      }
    >
      {MACRO_KEYS.map((k) => (
        <div className="card tight" key={k}>
          <div className="card-title">
            <span>{MACRO_META[k].icon} {MACRO_META[k].label}</span>
            <span style={{ textTransform: 'none', letterSpacing: 0 }}>{MACRO_META[k].unit}</span>
          </div>
          <Field label="Objetivo">
            <NumberInput value={t[k].target} step={k === 'kcal' ? 50 : 1} onChange={(v) => setTargetWithRange(k, v)} />
          </Field>
          <div className="grid-2">
            <Field label="Mínimo aceptable">
              <NumberInput value={t[k].min} onChange={(v) => setMacro(k, 'min', v)} />
            </Field>
            <Field label="Máximo aceptable">
              <NumberInput value={t[k].max} onChange={(v) => setMacro(k, 'max', v)} />
            </Field>
          </div>
        </div>
      ))}

      {drift > t.kcal.target * 0.08 && (
        <div className="estimate">
          <span aria-hidden="true">⚠️</span>
          <div>
            Tus macros suman {Math.round(macroSum)} kcal pero el objetivo de calorías es {t.kcal.target}. Si es
            a propósito, adelante; si no, ajusta los carbohidratos.
          </div>
        </div>
      )}

      <EstimateNotice>
        El objetivo no es un número que haya que clavar: es el centro de un rango. Quedarte dentro del rango ya
        es cumplir.
      </EstimateNotice>

      <p className="note">
        Cálculo automático actual: {g(computeTargets({
          sex: p.sex, weightKg: p.startWeightKg, heightCm: p.heightCm, age: profileAge(p),
          activityLevel: p.activityLevel, typicalSteps: p.typicalSteps,
          trainingDaysPerWeek: p.trainingDaysPerWeek, goal: p.goal,
        }).kcal.target)} kcal.
      </p>
    </Sheet>
  );
}

// ───────────────────────────── Historial ─────────────────────────────

export function HistorySheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const ui = useUI();
  const [span, setSpan] = useState(30);

  const byDate = useMemo(() => groupEntriesByDate(app.history.entries), [app.history.entries]);
  const days = useMemo(() => lastNDays(span).reverse(), [span]);

  return (
    <Sheet title="Historial" subtitle="Toca un día para verlo" onClose={onClose}>
      <div className="chips" style={{ marginBottom: 12 }}>
        {[7, 30, 90].map((s) => (
          <button key={s} className="chip" aria-pressed={span === s} onClick={() => setSpan(s)}>{s} días</button>
        ))}
      </div>
      <div className="list">
        {days.map((d) => {
          const entries = byDate.get(d) ?? [];
          const n = nutrientsForEntries(entries);
          const day = app.history.days.get(d);
          return (
            <button className="row" key={d} onClick={() => { app.setDate(d); ui.setTab('today'); onClose(); }}>
              <div className="row-main">
                <div className="row-title" style={{ fontSize: '0.88rem' }}>{formatDayLabel(d)}</div>
                <div className="row-sub">
                  {entries.length ? `${entries.length} comidas` : 'sin registro'}
                  {day?.training ? ` · 🏋️ ${day.training.focus}` : ''}
                  {day?.steps != null ? ` · 🚶 ${g(day.steps)}` : ''}
                </div>
              </div>
              <div className="row-side">
                {entries.length ? <>{g(n.kcal)} kcal<br /><span style={{ fontSize: '0.7rem', color: 'var(--text-faint)' }}>{g(n.protein)} g prot</span></> : '—'}
              </div>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}

// ───────────────────────────── Privacidad ─────────────────────────────

export function PrivacySheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const ui = useUI();
  const [confirm, setConfirm] = useState('');
  const counts = {
    entries: app.history.entries.length,
    weights: app.weights.length,
    recipes: app.recipes.length,
    saved: app.savedMeals.length,
    customFoods: app.foods.filter((f) => f.custom).length,
  };

  return (
    <Sheet title="Borrar todos mis datos" onClose={onClose}
      footer={
        <button className="btn danger" disabled={confirm.trim().toUpperCase() !== 'BORRAR'}
          onClick={async () => {
            await deleteAllData();
            ui.notify('Todos tus datos han sido borrados de este dispositivo.');
            onClose();
            window.location.reload();
          }}>
          Borrar definitivamente
        </button>
      }>
      <div className="estimate" style={{ borderColor: 'var(--bad)' }}>
        <span aria-hidden="true">⚠️</span>
        <div>
          Esto es <b>irreversible</b>. Se borrará todo de este dispositivo y no hay copia en ningún servidor
          porque nunca la ha habido.
        </div>
      </div>

      <Card title="Lo que se va a borrar">
        <div className="list">
          <Row label="Comidas registradas" value={counts.entries} />
          <Row label="Pesadas" value={counts.weights} />
          <Row label="Recetas" value={counts.recipes} />
          <Row label="Comidas habituales" value={counts.saved} />
          <Row label="Alimentos creados por ti" value={counts.customFoods} />
          <Row label="Tu perfil y objetivos" value={1} />
        </div>
      </Card>

      <p className="note">
        Si lo que quieres es una copia antes de borrar, cierra esto y usa <b>Exportar</b> en el perfil.
      </p>

      <Field label="Escribe BORRAR para confirmar">
        <input className="input" value={confirm} onChange={(e) => setConfirm(e.target.value)} placeholder="BORRAR" />
      </Field>
    </Sheet>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="row">
      <div className="row-main"><div className="row-title" style={{ fontSize: '0.88rem' }}>{label}</div></div>
      <div className="row-side">{value}</div>
    </div>
  );
}

// ───────────────────────────── Ajustes de IA ─────────────────────────────

export function AiSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const ui = useUI();
  const [key, setKey] = useState(app.settings.aiApiKey ?? '');
  const [model, setModel] = useState(app.settings.aiModel || DEFAULT_AI_MODEL);
  const [testing, setTesting] = useState(false);
  const [result, setResult] = useState<string | null>(null);

  const enabled = app.settings.aiProvider === 'anthropic' && !!app.settings.aiApiKey;

  return (
    <Sheet
      title="🤖 Análisis de fotos con IA"
      subtitle={enabled ? 'Activado' : 'Desactivado'}
      onClose={onClose}
      footer={
        <div className="btn-row">
          <button className="btn ghost" disabled={!key.trim() || testing} onClick={async () => {
            setTesting(true);
            setResult(null);
            try {
              await testApiKey(key.trim(), model);
              setResult('✅ La clave funciona.');
            } catch (err) {
              setResult(`⚠️ ${describeAiError(err)}`);
            } finally {
              setTesting(false);
            }
          }}>
            {testing ? <span className="spinner" /> : 'Probar clave'}
          </button>
          <button className="btn primary" onClick={async () => {
            await app.actions.setSettings({
              aiApiKey: key.trim() || undefined,
              aiProvider: key.trim() ? 'anthropic' : 'none',
              aiModel: model,
            });
            ui.notify(key.trim() ? 'Análisis con IA activado.' : 'Análisis con IA desactivado.');
            onClose();
          }}>Guardar</button>
        </div>
      }
    >
      <p className="note">
        Esto activa dos cosas: el <b>reconocimiento automático de platos</b> por fotografía y la
        <b> transcripción automática de etiquetas</b>.
      </p>
      <p className="note">
        Deliberadamente, nada más depende de esto. El registro por voz, el escáner de códigos de barras, la
        base de alimentos, el recomendador y todo el seguimiento funcionan sin clave y sin conexión.
      </p>

      <Field label="Clave de la API de Anthropic" hint="Se guarda solo en este dispositivo y nunca se incluye en las copias de seguridad.">
        <input className="input" type="password" value={key} onChange={(e) => setKey(e.target.value)}
          placeholder="sk-ant-..." autoComplete="off" spellCheck={false} />
      </Field>

      <Field label="Modelo">
        <select className="input" value={model} onChange={(e) => setModel(e.target.value)}>
          <option value="claude-opus-5-5">Claude Opus 5.5 (mejor estimación)</option>
          <option value="claude-sonnet-5-5">Claude Sonnet 5.5 (más económico)</option>
        </select>
      </Field>

      {result && <div className="note-strong" style={{ marginBottom: 12 }}><span className="note">{result}</span></div>}

      <div className="estimate">
        <span aria-hidden="true">🔐</span>
        <div>
          <b>Aviso honesto sobre la clave.</b> Las peticiones van de este navegador directamente a la API, sin
          servidor intermedio. Eso es bueno para tu privacidad —nadie más ve tus fotos— pero significa que la
          clave vive en el navegador: cualquiera con acceso a este dispositivo podría leerla. Usa una clave
          dedicada y ponle un límite de gasto en tu cuenta.
        </div>
      </div>

      <p className="note" style={{ marginBottom: 0 }}>
        Cada análisis de un plato cuesta unas décimas de céntimo. Las fotos se reducen a 1024 px antes de
        enviarse para que la petición sea pequeña.
      </p>
    </Sheet>
  );
}
