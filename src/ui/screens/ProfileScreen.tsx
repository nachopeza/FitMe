import { useState } from 'react';
import { useApp } from '../../features/store';
import { exportAll, importAll, type ExportBundle } from '../../data/db';
import { estimateMaintenance, profileAge } from '../../domain/nutrition';
import { GOAL_LABEL, MACRO_KEYS, MEAL_SLOTS, MEAL_SLOT_LABEL, type ActivityLevel, type Goal, type Hunger, type Sex } from '../../domain/types';
import { Section, Field, MACRO_META, NumberInput, Segmented, WhyButton, g } from '../components';
import { MacroAnalysis } from '../../features/sheets/MacroAnalysis';
import { Icon } from '../icons';
import { useUI } from '../shell';

const ACTIVITY_LABEL: Record<ActivityLevel, string> = {
  sedentary: 'Sedentaria (trabajo sentado, poco movimiento)',
  light: 'Ligera (algo de movimiento diario)',
  moderate: 'Moderada (bastante de pie o caminando)',
  active: 'Activa (trabajo físico o muchos pasos)',
  veryActive: 'Muy activa (trabajo físico exigente)',
};

const APPETITE_LABEL: Record<Hunger, string> = {
  high: 'Suelo tener mucha hambre',
  normal: 'Normal',
  low: 'Me cuesta comer mucho',
  veryLow: 'Me cuesta bastante comer',
};

export function ProfileScreen() {
  const app = useApp();
  const ui = useUI();
  const p = app.profile;
  const [busy, setBusy] = useState(false);

  if (!p) return <div className="screen"><p className="note">Cargando perfil…</p></div>;

  const patch = async (change: Partial<typeof p>) => {
    await app.actions.saveProfile({ ...p, ...change });
    await app.actions.recomputeTargets({ ...p, ...change });
  };

  const maintenance = estimateMaintenance({
    sex: p.sex, weightKg: p.startWeightKg, heightCm: p.heightCm, age: profileAge(p),
    activityLevel: p.activityLevel, typicalSteps: p.typicalSteps, trainingDaysPerWeek: p.trainingDaysPerWeek,
  });

  return (
    <div className="screen">
      <header className="screen-header">
        <h1>Perfil</h1>
      </header>

      <Section title="Tus datos">
        <Field label="Peso de referencia" hint="Se usa solo si aún no hay pesadas suficientes. Con datos, manda la media móvil.">
          <NumberInput value={p.startWeightKg} step={0.1} suffix="kg"
            onChange={(v) => void patch({ startWeightKg: v })} />
        </Field>
        <Field label="Altura">
          <NumberInput value={p.heightCm} suffix="cm" onChange={(v) => void patch({ heightCm: v })} />
        </Field>
        <Field label="Edad">
          <NumberInput value={profileAge(p)} suffix="años"
            onChange={(v) => void patch({ birthYear: new Date().getFullYear() - v })} />
        </Field>
        <Field label="Sexo" hint="Solo se usa para estimar el metabolismo basal.">
          <Segmented<Sex> value={p.sex} onChange={(v) => void patch({ sex: v })}
            options={[{ value: 'male', label: 'Hombre' }, { value: 'female', label: 'Mujer' }]} />
        </Field>
      </Section>

      <Section title="Actividad y entrenamiento">
        <Field label="Actividad diaria (sin contar el entrenamiento)">
          <select className="input" value={p.activityLevel} onChange={(e) => void patch({ activityLevel: e.target.value as ActivityLevel })}>
            {Object.entries(ACTIVITY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Pasos habituales al día">
          <NumberInput value={p.typicalSteps} step={500} suffix="pasos"
            onChange={(v) => void patch({ typicalSteps: v })} />
        </Field>
        <Field label="Días de entrenamiento por semana">
          <NumberInput value={p.trainingDaysPerWeek} min={0} max={7} suffix="días"
            onChange={(v) => void patch({ trainingDaysPerWeek: v })} />
        </Field>
        <Field label="Tipo de entrenamiento">
          <input className="input" value={p.trainingStyle} onChange={(e) => void patch({ trainingStyle: e.target.value })} />
        </Field>
        <Field label="Hora habitual de entrenamiento" hint="Condiciona las propuestas de cena: si entrenas tarde, se priorizan comidas rápidas.">
          <input className="input" type="time" value={p.trainingTime} onChange={(e) => void patch({ trainingTime: e.target.value })} />
        </Field>
        <Field label="Dónde entrenas">
          <Segmented value={p.trainingLocation} onChange={(v) => void patch({ trainingLocation: v })}
            options={[{ value: 'home' as const, label: 'Casa' }, { value: 'gym' as const, label: 'Gimnasio' }, { value: 'both' as const, label: 'Ambos' }]} />
        </Field>
      </Section>

      <Section title="Objetivo">
        <Field label="Qué buscas">
          <select className="input" value={p.goal} onChange={(e) => void patch({ goal: e.target.value as Goal })}>
            {Object.entries(GOAL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Nivel de apetito habitual" hint="Con poco apetito, la app propone comidas más pequeñas y densas en lugar de más volumen.">
          <select className="input" value={p.appetite} onChange={(e) => void patch({ appetite: e.target.value as Hunger })}>
            {Object.entries(APPETITE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <div className="panel">
          <b style={{ fontSize: '0.78rem' }}>Mantenimiento estimado: {g(maintenance.maintenance)} kcal/día</b>
          <div style={{ marginTop: 6 }}>
            <WhyButton reasons={maintenance.notes} label="Ver el desglose" />
          </div>
        </div>
      </Section>

      <Section title="Objetivos nutricionales" action={<button className="link" onClick={() => ui.open({ k: 'targets' })}>Editar a mano</button>}>
        <div className="rows">
          {MACRO_KEYS.map((k) => (
            <div className="row" key={k}>
              <div className="row-body">
                <div className="row-name" style={{ fontSize: '0.88rem' }}>{MACRO_META[k].label}</div>
                <div className="row-meta">Rango {g(app.baseTargets[k].min)}–{g(app.baseTargets[k].max)} {MACRO_META[k].unit}</div>
              </div>
              <div className="row-num">{g(app.baseTargets[k].target)} {MACRO_META[k].unit}</div>
            </div>
          ))}
        </div>
        {p.manualKcalOffset !== 0 && (
          <p className="note" style={{ marginTop: 10, marginBottom: 0 }}>
            Incluye un ajuste acumulado de {p.manualKcalOffset > 0 ? '+' : ''}{p.manualKcalOffset} kcal/día a partir de tu evolución real.
          </p>
        )}
      </Section>

      <MacroAnalysis profile={p} />

      <Section title="Horario de comidas">
        {MEAL_SLOTS.filter((s) => s !== 'extra').map((slot) => (
          <Field key={slot} label={MEAL_SLOT_LABEL[slot]}>
            <input className="input" type="time" value={p.mealTimes[slot] ?? ''}
              onChange={(e) => void patch({ mealTimes: { ...p.mealTimes, [slot]: e.target.value } })} />
          </Field>
        ))}
        <p className="note" style={{ marginBottom: 0 }}>
          Sirve para clasificar automáticamente lo que registras y para no forzarte un desayuno enorme si
          desayunas a las 11:00.
        </p>
      </Section>

      <Section title="Restricciones y preferencias">
        <Field label="Restricciones" hint="Separadas por comas. Por ejemplo: sin lactosa, sin cerdo.">
          <input className="input" value={p.restrictions.join(', ')} placeholder="ninguna"
            onChange={(e) => void patch({ restrictions: e.target.value.split(',').map((s) => s.trim()).filter(Boolean) })} />
        </Field>
        <Field label="Presupuesto aproximado">
          <Segmented value={p.budget} onChange={(v) => void patch({ budget: v })}
            options={[{ value: 'low' as const, label: 'Ajustado' }, { value: 'medium' as const, label: 'Normal' }, { value: 'high' as const, label: 'Holgado' }]} />
        </Field>
        <Field label="Alimentos que no quieres que te proponga">
          <div className="chips">
            {p.dislikes.length === 0 && <span className="note">Ninguno marcado. Puedes marcarlos desde la ficha de cada alimento.</span>}
            {p.dislikes.map((id) => (
              <button key={id} className="chip" aria-pressed
                onClick={() => void patch({ dislikes: p.dislikes.filter((d) => d !== id) })}>
                {app.foodsById.get(id)?.name ?? id}
              </button>
            ))}
          </div>
        </Field>
      </Section>

      <Section title="Tu cuenta">
        <button className="row" style={{ width: '100%' }} onClick={() => ui.open({ k: 'account' })}>
          <span className="meal-add" style={{ marginRight: 2 }}><Icon name="profile" size={16} /></span>
          <div className="row-body">
            <div className="row-name">
              {app.settings.syncSession ? app.settings.syncSession.email : 'Sin cuenta'}
            </div>
            <div className="row-meta">
              {app.settings.syncSession
                ? app.settings.lastSyncAt
                  ? `Sincronizado ${new Date(app.settings.lastSyncAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' })}`
                  : 'Pendiente de la primera sincronización'
                : 'Los datos viven solo en este móvil'}
            </div>
          </div>
          <Icon name="chevron" size={18} />
        </button>
      </Section>

      {/* Cuadrícula de herramientas: antes eran tres botones en una rejilla de
          dos columnas, con el tercero descolgado. */}
      <Section title="Herramientas">
        <div className="tools">
          {([
            ['calendar', 'calendar', 'Calendario', 'Tus días'],
            ['basics', 'bowl', 'Mis básicos', 'Un toque'],
            ['recipe', 'book', 'Recetas', 'Lo que cocinas'],
            ['shopping', 'cart', 'La compra', 'Lo que falta'],
            ['compare', 'progress', 'Comparador', 'Dos alimentos'],
            ['calculator', 'pen', 'Calculadora', 'Cuentas sueltas'],
          ] as const).map(([sheet, icon, label, sub]) => (
            <button className="tool" key={sheet} onClick={() => ui.open({ k: sheet })}>
              <span className="tool-ico"><Icon name={icon} size={19} /></span>
              <span className="tool-name">{label}</span>
              <span className="tool-sub">{sub}</span>
            </button>
          ))}
        </div>
        <button className="btn" style={{ marginTop: 11 }} onClick={() => ui.open({ k: 'ai' })}>
          Análisis de fotos con IA
        </button>
      </Section>

      <Section title="Apariencia">
        <Segmented value={app.settings.theme} onChange={(v) => { void app.actions.setSettings({ theme: v }); applyTheme(v); }}
          options={[{ value: 'dark' as const, label: 'Oscuro' }, { value: 'light' as const, label: 'Claro' }, { value: 'system' as const, label: 'Sistema' }]} />
      </Section>

      {/* ── Privacidad ── */}
      <Section title="Tus datos y privacidad">
        <p className="note">
          Todo se guarda solo en este dispositivo. No hay cuenta, no hay servidor y nada se usa para
          publicidad. Las únicas conexiones externas son la consulta de códigos de barras y, si la activas tú,
          el análisis de fotos con IA.
        </p>
        <div className="btns">
          <button className="btn sm" disabled={busy} onClick={async () => {
            setBusy(true);
            try {
              const bundle = await exportAll();
              const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `fitme-copia-${new Date().toISOString().slice(0, 10)}.json`;
              a.click();
              URL.revokeObjectURL(url);
              ui.notify('Copia exportada. La clave de la IA nunca se incluye.');
            } finally { setBusy(false); }
          }}>Exportar</button>
          <label className="btn sm" style={{ cursor: 'pointer' }}>Importar
            <input type="file" accept="application/json" className="sr-only" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const bundle = JSON.parse(await file.text()) as ExportBundle;
                await importAll(bundle, 'merge');
                ui.notify('Datos importados y combinados con los actuales.');
              } catch (err) {
                ui.notify(err instanceof Error ? err.message : 'No se ha podido leer el archivo.');
              }
              e.target.value = '';
            }} />
          </label>
        </div>
        <div className="btns one">
          <button className="btn danger sm" onClick={() => ui.open({ k: 'privacy' })}>Borrar todos mis datos</button>
        </div>
      </Section>

      <Section title="Aviso">
        <p className="note" style={{ marginBottom: 0 }}>
          FitMe estima; no mide. Una foto de un plato no permite conocer los gramos exactos, y las calorías de
          un reloj son una aproximación. Esta app no diagnostica nada: si tienes molestias digestivas
          persistentes o algo que te preocupe, consúltalo con un profesional sanitario.
        </p>
      </Section>
    </div>
  );
}

export function applyTheme(theme: 'dark' | 'light' | 'system') {
  const root = document.documentElement;
  if (theme === 'system') root.removeAttribute('data-theme');
  else root.setAttribute('data-theme', theme);
}
