import { useMemo, useState } from 'react';
import {
  Area, AreaChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';
import { useApp } from '../../features/store';
import { addDays, formatShortDate, lastNDays, toIsoDate, weekStart } from '../../domain/dates';
import {
  dailyWeights, movingAverage, nutrientsForEntries, groupEntriesByDate, readTrend,
  gainVerdict, suggestAdjustment, weeklySummary, type GainVerdict,
} from '../../domain/trends';
import { MACRO_KEYS, type IsoDate, type MacroKey } from '../../domain/types';
import { Section, MACRO_META, WhyButton, g } from '../components';
import { useUI } from '../shell';

type Span = 7 | 30 | 90;

export function ProgressScreen() {
  const app = useApp();
  const ui = useUI();
  const [span, setSpan] = useState<Span>(30);
  const [metric, setMetric] = useState<MacroKey>('kcal');

  const today = toIsoDate();
  const byDate = useMemo(() => groupEntriesByDate(app.history.entries), [app.history.entries]);
  const daily = useMemo(() => dailyWeights(app.weights), [app.weights]);
  const trend = useMemo(() => readTrend(app.weights, today), [app.weights, today]);

  /** El veredicto del ritmo, sobre el peso más reciente que se conozca. */
  const verdict = useMemo(
    () => gainVerdict(
      trend.weeklyChangeKg,
      trend.weightMa7 ?? app.weights.at(-1)?.kg ?? app.profile?.startWeightKg ?? 70,
    ),
    [trend, app.weights, app.profile?.startWeightKg],
  );

  /** Serie diaria de macros y peso, con la media móvil del peso de 7 días. */
  const series = useMemo(() => {
    return lastNDays(span, today).map((d) => {
      const n = nutrientsForEntries(byDate.get(d) ?? []);
      const logged = (byDate.get(d) ?? []).length > 0;
      return {
        date: d,
        label: formatShortDate(d),
        kcal: logged ? Math.round(n.kcal) : null,
        protein: logged ? Math.round(n.protein) : null,
        carbs: logged ? Math.round(n.carbs) : null,
        fat: logged ? Math.round(n.fat) : null,
        fiber: logged ? Math.round(n.fiber) : null,
        weight: daily.get(d) ?? null,
        weightMa: movingAverage(daily, d, 7),
        steps: app.history.days.get(d)?.steps ?? null,
        trained: !!app.history.days.get(d)?.training,
      };
    });
  }, [span, today, byDate, daily, app.history.days]);

  /** Últimas semanas, de la más reciente a la más antigua. */
  const weeks = useMemo(() => {
    const out = [];
    const thisWeek = weekStart(today);
    for (let i = 0; i < 8; i++) {
      const ws: IsoDate = addDays(thisWeek, -7 * i);
      out.push(
        weeklySummary({
          week: ws,
          entries: app.history.entries.filter((e) => e.date >= ws && e.date < addDays(ws, 7)),
          days: app.history.days,
          weights: app.weights,
          targets: app.baseTargets,
          expectedTrainings: app.profile?.trainingDaysPerWeek ?? 4,
        }),
      );
    }
    return out;
  }, [today, app.history, app.weights, app.baseTargets, app.profile]);

  const adjustment = useMemo(
    () =>
      suggestAdjustment({
        goal: app.profile?.goal ?? 'leanGain',
        // El motor espera las semanas de la más antigua a la más reciente.
        weeks: [...weeks].reverse(),
        trend,
        targets: app.baseTargets,
      }),
    [weeks, trend, app.baseTargets, app.profile],
  );

  const current = weeks[0];
  const weightPoints = series.filter((s) => s.weight != null || s.weightMa != null);

  return (
    <div className="screen">
      <header className="screen-header">
        <div>
          <h1>Progreso</h1>
          <div className="screen-sub">Tendencias, no días sueltos</div>
        </div>
        <button className="btn sm auto ghost" onClick={() => ui.open({ k: 'weight' })}>+ Peso</button>
      </header>

      {/* ── La pregunta de esta pantalla ──
          Igual que HOY abre con lo que falta por comer, PROGRESO abre con lo
          único que decide si el plan funciona: a qué ritmo sube el peso. Nueve
          cifras en rejilla no respondían a eso; había que buscarlas. */}
      <div className="hero" style={{ ['--behind' as string]: 'var(--m-protein)' }}>
        <div className="gap-label">Ritmo de las últimas semanas</div>
        <div className={`rate rate-${verdict.state}`}>
          <span className="rate-figure">
            {trend.weeklyChangeKg != null
              ? `${trend.weeklyChangeKg >= 0 ? '+' : ''}${trend.weeklyChangeKg.toFixed(2)}`
              : '—'}
          </span>
          <span className="rate-unit">kg por semana</span>
        </div>

        {/* La franja dice dónde cae su ritmo dentro de lo recomendable. */}
        <div className="rate-band" role="img"
          aria-label={`Rango recomendado entre ${verdict.min} y ${verdict.max} kg por semana`}>
          <span className="rate-ok" />
          {trend.weeklyChangeKg != null && (
            <span className="rate-pin" style={{ left: `${pinAt(trend.weeklyChangeKg, verdict)}%` }} />
          )}
        </div>
        <div className="rate-scale">
          <span>perder</span>
          <span>{verdict.min}–{verdict.max} kg</span>
          <span>de más</span>
        </div>

        <p className="rate-msg">{verdict.message}</p>

        <div className="hero-foot">
          <span className="note tight" style={{ margin: 0 }}>
            Media de 7 días: <b>{trend.weightMa7 != null ? `${trend.weightMa7.toFixed(1)} kg` : '—'}</b>
            {' · '}{trend.weighInDays} pesadas en 14 días
          </span>
        </div>
      </div>

      {/* ── La semana, en dos cifras y una línea ── */}
      <Section title="Esta semana">
        {current.daysLogged > 0 && current.daysLogged < 3 && (
          <p className="note" style={{ marginTop: -2, marginBottom: 10 }}>
            Con {current.daysLogged} {current.daysLogged === 1 ? 'día' : 'días'} de registro estas medias
            todavía no significan gran cosa. A partir de 4 o 5 días empiezan a ser útiles.
          </p>
        )}

        {/* Energía y proteína con su objetivo: son las dos que mueven la aguja.
            Las demás van en una línea, que es el peso que les corresponde. */}
        <div className="macro-mini">
          {([
            ['kcal', 'Energía al día', current.avgKcal, app.baseTargets.kcal.target, 'kcal'],
            ['protein', 'Proteína al día', current.avgProtein, app.baseTargets.protein.target, 'g'],
          ] as const).map(([key, label, value, target, unit]) => (
            <div className="macro-mini-item" key={key}>
              <span className="macro-mini-name">{label}</span>
              <span className="macro-mini-bar">
                <span style={{
                  width: `${Math.min(100, (value / Math.max(1, target)) * 100)}%`,
                  background: `var(--m-${key})`,
                }} />
              </span>
              <span className="macro-mini-read">
                <b>{current.daysLogged ? g(value) : '—'}</b> / {g(target)} {unit}
              </span>
            </div>
          ))}
        </div>

        <p className="note tight" style={{ marginTop: 12 }}>
          {current.daysLogged
            ? <>Carbohidratos <b>{g(current.avgCarbs)} g</b>, grasas <b>{g(current.avgFat)} g</b>,
              fibra <b>{g(current.avgFiber)} g</b>. {current.trainings} {current.trainings === 1 ? 'entreno' : 'entrenos'} de
              los {app.profile?.trainingDaysPerWeek ?? 4} previstos{current.avgSteps ? `, ${g(current.avgSteps)} pasos al día` : ''}.</>
            : 'Todavía no hay días registrados esta semana.'}
        </p>

        <div className="divider" />
        <div className="macro-top">
          <span className="macro-name">Consistencia</span>
          <span className="macro-read"><b>{current.consistency.value}</b> <span>/ 100 · {current.consistency.label}</span></span>
        </div>
        <div className="track">
          <span className="track-fill" style={{ width: `${current.consistency.value}%`, background: 'var(--m-fiber)' }} />
        </div>
        <p className="note" style={{ marginTop: 8, marginBottom: 0 }}>
          No es una nota. Mide si hay suficiente regularidad —proteína, registro, entrenamiento— para poder
          tomar decisiones con tus datos en lugar de a ciegas. Las medias se calculan sobre los días que has
          registrado, no dividiendo entre siete: un día sin registrar no es un día sin comer.
        </p>
      </Section>

      {/* ── Ajuste automático ── */}
      <Section title="Ajuste del objetivo">
        {adjustment.action === 'needMoreData' ? (
          <>
            <p className="note">{adjustment.reasons[0]}</p>
            <div className="panel">
              <b style={{ fontSize: '0.78rem' }}>Para poder ajustar falta:</b>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {adjustment.missing.map((m, i) => <li key={i} className="note">{m}</li>)}
              </ul>
            </div>
          </>
        ) : (
          <>
            <div className="macro-top">
              <span className="macro-name">
                {adjustment.action === 'increase' ? '↑ Podríamos subir un poco' : adjustment.action === 'decrease' ? '↓ Podríamos bajar un poco' : '= Mantener'}
              </span>
              {adjustment.deltaKcal !== 0 && (
                <span className="macro-read"><b>{adjustment.deltaKcal > 0 ? '+' : ''}{adjustment.deltaKcal}</b> <span>kcal/día</span></span>
              )}
            </div>
            <WhyButton reasons={adjustment.reasons} label="Ver el razonamiento" />
            {adjustment.deltaKcal !== 0 && app.profile && (
              <button
                className="btn primary"
                style={{ marginTop: 10 }}
                onClick={async () => {
                  const p = app.profile!;
                  await app.actions.saveProfile({ ...p, manualKcalOffset: p.manualKcalOffset + adjustment.deltaKcal });
                  await app.actions.recomputeTargets();
                  ui.notify(`Objetivo ajustado en ${adjustment.deltaKcal > 0 ? '+' : ''}${adjustment.deltaKcal} kcal/día.`);
                }}
              >
                Aplicar ajuste de {adjustment.deltaKcal > 0 ? '+' : ''}{adjustment.deltaKcal} kcal
              </button>
            )}
          </>
        )}
      </Section>

      {/* ── Peso ── */}
      <Section title="Peso" action={
        <span className={`tag ${trend.direction === 'up' ? 'info' : trend.direction === 'down' ? 'warn' : ''}`}>
          {trend.direction === 'up' ? '↑ Subiendo' : trend.direction === 'down' ? '↓ Bajando' : trend.direction === 'flat' ? '= Estable' : 'Sin datos'}
        </span>
      }>
        {weightPoints.length < 2 ? (
          <div className="empty">
            Con 3-4 pesadas por semana la tendencia se vuelve fiable.
            <br />Una sola pesada no dice nada.
          </div>
        ) : (
          <>
            <div className="figures">
              <Stat label="Media 7 días" value={trend.weightMa7 != null ? `${trend.weightMa7.toFixed(1)} kg` : '—'} />
              <Stat label="Cambio/semana" value={trend.weeklyChangeKg != null ? `${trend.weeklyChangeKg >= 0 ? '+' : ''}${trend.weeklyChangeKg.toFixed(2)} kg` : '—'} />
              <Stat label="Pesadas (14 d)" value={`${trend.weighInDays}`} />
            </div>
            <div className="chart">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={weightPoints} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
                  <CartesianGrid stroke="var(--line)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fill: 'var(--text-faint)', fontSize: 10 }} interval="preserveStartEnd" />
                  <YAxis domain={['dataMin - 0.6', 'dataMax + 0.6']} tick={{ fill: 'var(--text-faint)', fontSize: 10 }} />
                  <Tooltip contentStyle={TOOLTIP} labelStyle={{ color: 'var(--text-dim)' }}
                    formatter={(v: number, name) => [`${Number(v).toFixed(1)} kg`, name === 'weight' ? 'Pesada' : 'Media 7 días']} />
                  <Line type="monotone" dataKey="weight" stroke="var(--text-faint)" strokeWidth={1} dot={{ r: 2 }} connectNulls name="weight" />
                  <Line type="monotone" dataKey="weightMa" stroke="var(--accent)" strokeWidth={2.4} dot={false} connectNulls name="weightMa" />
                </LineChart>
              </ResponsiveContainer>
            </div>
            <div className="chart-legend">
              <span><span className="legend-dot" style={{ background: 'var(--text-faint)' }} />Pesadas diarias</span>
              <span><span className="legend-dot" style={{ background: 'var(--accent)' }} />Media móvil de 7 días</span>
            </div>
            <p className="note" style={{ marginTop: 8, marginBottom: 0 }}>
              La línea azul es la que cuenta. Una subida de 0,8 kg de un día para otro es agua, glucógeno,
              sodio y contenido intestinal: no es grasa.
            </p>
          </>
        )}
      </Section>

      {/* ── Gráficas de ingesta ── */}
      <Section title="Ingesta" action={
        <div className="seg" style={{ padding: 3 }}>
          {([7, 30, 90] as Span[]).map((s) => (
            <button key={s} aria-pressed={span === s} onClick={() => setSpan(s)} style={{ padding: '4px 8px', fontSize: '0.72rem', minHeight: 0 }}>
              {s} d
            </button>
          ))}
        </div>
      }>
        <div className="chips" style={{ marginBottom: 10 }}>
          {MACRO_KEYS.map((k) => (
            <button key={k} className="chip" aria-pressed={metric === k} onClick={() => setMetric(k)}>
              {MACRO_META[k].short}
            </button>
          ))}
        </div>
        <div className="chart">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={series} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
              <CartesianGrid stroke="var(--line)" vertical={false} />
              <XAxis dataKey="label" tick={{ fill: 'var(--text-faint)', fontSize: 10 }} interval="preserveStartEnd" />
              <YAxis tick={{ fill: 'var(--text-faint)', fontSize: 10 }} />
              <Tooltip contentStyle={TOOLTIP} formatter={(v: number) => [`${g(Number(v))} ${MACRO_META[metric].unit}`, MACRO_META[metric].label]} />
              <Area type="monotone" dataKey={metric} stroke={MACRO_META[metric].color}
                fill={MACRO_META[metric].color} fillOpacity={0.16} strokeWidth={2} connectNulls={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <p className="note" style={{ marginBottom: 0 }}>
          Los días sin registro aparecen vacíos en lugar de contarse como cero: un hueco no es un ayuno.
        </p>
      </Section>

      {/* ── Peso frente a ingesta ── */}
      {weightPoints.length >= 4 && (
        <Section title="Peso frente a ingesta">
          <div className="chart">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={series} margin={{ top: 8, right: 6, left: -22, bottom: 0 }}>
                <CartesianGrid stroke="var(--line)" vertical={false} />
                <XAxis dataKey="label" tick={{ fill: 'var(--text-faint)', fontSize: 10 }} interval="preserveStartEnd" />
                <YAxis yAxisId="w" domain={['dataMin - 0.6', 'dataMax + 0.6']} tick={{ fill: 'var(--text-faint)', fontSize: 10 }} />
                <YAxis yAxisId="k" orientation="right" tick={{ fill: 'var(--text-faint)', fontSize: 10 }} />
                <Tooltip contentStyle={TOOLTIP} />
                <Line yAxisId="w" type="monotone" dataKey="weightMa" stroke="var(--accent)" strokeWidth={2.4} dot={false} connectNulls name="Peso (media 7 d)" />
                <Line yAxisId="k" type="monotone" dataKey="kcal" stroke="var(--kcal)" strokeWidth={1.6} dot={false} connectNulls name="kcal" />
              </LineChart>
            </ResponsiveContainer>
          </div>
          <p className="note" style={{ marginBottom: 0 }}>
            Es la comparación que de verdad responde a «¿estoy comiendo suficiente para ganar músculo?».
          </p>
        </Section>
      )}

      {/* ── Historial semanal ── */}
      <Section title="Semanas anteriores" action={<button className="link" onClick={() => ui.open({ k: 'history' })}>Ver historial</button>}>
        <div className="rows">
          {weeks.filter((w) => w.daysLogged > 0).map((w) => (
            <div className="row" key={w.weekStart}>
              <div className="row-body">
                <div className="row-name" style={{ fontSize: '0.88rem' }}>Semana del {formatShortDate(w.weekStart)}</div>
                <div className="row-meta">
                  {w.daysLogged}/7 días · {w.trainings} entrenos · {w.avgWeightKg != null ? `${w.avgWeightKg} kg` : 'sin peso'}
                </div>
              </div>
              <div className="row-num">{g(w.avgKcal)} kcal<br /><span style={{ color: 'var(--text-faint)', fontSize: '0.7rem' }}>{g(w.avgProtein)} g prot</span></div>
            </div>
          ))}
          {weeks.every((w) => w.daysLogged === 0) && (
            <div className="empty">Aún no hay semanas con datos.</div>
          )}
        </div>
      </Section>
    </div>
  );
}

const TOOLTIP = {
  background: 'var(--bg-elev-2)',
  border: '1px solid var(--line-strong)',
  borderRadius: 10,
  fontSize: 12,
  color: 'var(--text)',
} as const;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="figure">
      <div className="figure-label">{label}</div>
      <div className="figure-value">{value}</div>
      {sub && <div className="figure-sub">{sub}</div>}
    </div>
  );
}

/**
 * Dónde cae su ritmo en la franja, de 0 a 100.
 *
 * El rango recomendable ocupa el tercio central a propósito: así se ve de un
 * vistazo si se queda corto o se pasa, sin que la escala real —que puede ir de
 * -0,5 a +1 kg— aplaste la zona que importa.
 */
function pinAt(weekly: number, v: GainVerdict): number {
  if (weekly <= 0) return Math.max(2, 33 * (1 + Math.max(-1, weekly / 0.5)));
  if (weekly < v.min) return 33 * (weekly / Math.max(0.01, v.min));
  if (weekly <= v.max) return 33 + 34 * ((weekly - v.min) / Math.max(0.01, v.max - v.min));
  return Math.min(98, 67 + 33 * ((weekly - v.max) / Math.max(0.01, v.max)));
}
