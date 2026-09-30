import { useRef, useState } from 'react';
import { searchFoods } from '../../domain/parser';
import { scaleNutrients } from '../../domain/nutrition';
import type { Confidence, Food, LoggedItem } from '../../domain/types';
import { EstimateNotice, Sheet } from '../../ui/components';
import { useUI } from '../../ui/shell';
import { useApp } from '../store';
import { ConfirmEntry } from './ConfirmEntry';
import { payloadToDataUrl, prepareImage } from './image';
import { analysePlate, describeAiError } from './aiClient';
import type { PlateAnalysis, PlateItem } from './ai';

/**
 * Análisis de plato por fotografía.
 *
 * Con IA configurada, identifica los ingredientes y estima cantidades CON RANGO.
 * Sin IA configurada no simula nada: muestra la foto y deja apuntar lo que se ve,
 * que sigue siendo más rápido que escribirlo de memoria.
 */
export function PhotoAnalyze({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const ui = useUI();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [payload, setPayload] = useState<Awaited<ReturnType<typeof prepareImage>> | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [analysis, setAnalysis] = useState<PlateAnalysis | null>(null);
  const [manual, setManual] = useState(false);

  const aiReady = app.settings.aiProvider === 'anthropic' && !!app.settings.aiApiKey;

  const pick = async (file: File) => {
    setError(null);
    try {
      const prepared = await prepareImage(file);
      setPayload(prepared);
      setPreview(payloadToDataUrl(prepared));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido leer la imagen.');
    }
  };

  const analyse = async () => {
    if (!payload) return;
    setBusy(true);
    setError(null);
    try {
      const pantry = app.profile?.pantryFoodIds
        .map((id) => app.foodsById.get(id))
        .filter((f): f is Food => !!f) ?? [];
      const result = await analysePlate(payload, { apiKey: app.settings.aiApiKey, model: app.settings.aiModel }, pantry);
      setAnalysis(result);
    } catch (err) {
      setError(describeAiError(err));
    } finally {
      setBusy(false);
    }
  };

  if (analysis) {
    const { items, notes } = mapAnalysis(analysis, app.foods);
    return (
      <ConfirmEntry
        title="Estimación de la foto"
        subtitle="Todo lo de aquí es una estimación"
        initialItems={items}
        unmatched={notes.unmatched}
        method="photo"
        onClose={onClose}
        notice={
          <>
            {preview && <img className="preview" src={preview} alt="Foto del plato analizada" style={{ marginBottom: 12 }} />}
            <EstimateNotice>
              <b>Una foto no permite conocer los gramos exactos.</b> Estas cantidades son estimaciones con un
              margen amplio. Revísalas: son tu mejor punto de partida, no una medición.
            </EstimateNotice>
            {analysis.notes.length > 0 && (
              <div className="card tight" style={{ marginTop: 12 }}>
                <div className="card-title"><span>Avisos del análisis</span></div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  {analysis.notes.map((n, i) => <li key={i} className="note">{n}</li>)}
                </ul>
              </div>
            )}
            {notes.ranges.length > 0 && (
              <div className="card tight">
                <div className="card-title"><span>Margen de cada cantidad</span></div>
                <div className="list">
                  {notes.ranges.map((r, i) => (
                    <div className="row" key={i}>
                      <div className="row-main"><div className="row-title" style={{ fontSize: '0.85rem' }}>{r.name}</div></div>
                      <div className="row-side">{r.low}–{r.high} g</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </>
        }
      />
    );
  }

  if (manual && preview) {
    return (
      <ConfirmEntry
        title="Apuntar mirando la foto"
        initialItems={[]}
        method="photo"
        onClose={onClose}
        notice={
          <>
            <img className="preview" src={preview} alt="Foto del plato" style={{ marginBottom: 12 }} />
            <EstimateNotice>
              Sin análisis automático activado. Busca abajo lo que ves en la foto y ajusta las cantidades.
            </EstimateNotice>
          </>
        }
      />
    );
  }

  return (
    <Sheet
      title="📸 Analizar plato"
      subtitle={aiReady ? 'Haz una foto de la comida' : 'Análisis automático no configurado'}
      onClose={onClose}
      footer={
        payload ? (
          aiReady ? (
            <div className="btn-row">
              <button className="btn ghost" onClick={() => setManual(true)}>Apuntar a mano</button>
              <button className="btn primary" disabled={busy} onClick={() => void analyse()}>
                {busy ? <span className="spinner" /> : 'Analizar'}
              </button>
            </div>
          ) : (
            <button className="btn primary" onClick={() => setManual(true)}>Apuntar mirando la foto</button>
          )
        ) : (
          <button className="btn primary" onClick={() => fileInput.current?.click()}>Elegir o hacer una foto</button>
        )
      }
    >
      <input
        ref={fileInput}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void pick(f);
          e.target.value = '';
        }}
      />

      {preview ? (
        <>
          <img className="preview" src={preview} alt="Foto seleccionada" />
          <button className="btn ghost sm" style={{ marginTop: 10 }} onClick={() => { setPreview(null); setPayload(null); }}>
            Cambiar foto
          </button>
        </>
      ) : (
        <div className="empty" style={{ padding: '36px 16px' }}>
          <span className="ico" aria-hidden="true">📷</span>
          Haz una foto del plato entero, desde arriba y con algo de referencia
          <br />(un cubierto, la mano) para que la estimación de tamaño sea mejor.
        </div>
      )}

      {error && (
        <div className="estimate" style={{ marginTop: 12, borderColor: 'var(--bad)' }}>
          <span aria-hidden="true">⚠️</span>
          <div>{error}</div>
        </div>
      )}

      {!aiReady && (
        <div className="card tight" style={{ marginTop: 12 }}>
          <div className="card-title"><span>Reconocimiento automático</span></div>
          <p className="note">
            El reconocimiento de platos necesita un modelo de visión. No viene activado porque ninguna función
            básica de la app debe depender de un servicio de pago: la voz, el escáner y la lectura de etiquetas
            funcionan sin él.
          </p>
          <p className="note" style={{ marginBottom: 0 }}>
            Si quieres activarlo, ve a <b>Perfil → Análisis de fotos con IA</b> y añade tu clave. Se guarda solo
            en este dispositivo.
          </p>
          <button className="btn sm" style={{ marginTop: 10 }} onClick={() => { onClose(); ui.open({ k: 'ai' }); }}>
            Configurarlo
          </button>
        </div>
      )}
    </Sheet>
  );
}

/**
 * Traduce lo que devuelve el modelo a items de registro reales.
 *
 * Todo alimento tiene que existir en la base local: así los macros salen de
 * datos de composición y no de lo que el modelo crea recordar. Lo que no encaja
 * se reporta como no reconocido en vez de inventarse.
 */
export function mapAnalysis(
  analysis: PlateAnalysis,
  foods: Food[],
): { items: LoggedItem[]; notes: { unmatched: string[]; ranges: { name: string; low: number; high: number }[] } } {
  const items: LoggedItem[] = [];
  const unmatched: string[] = [];
  const ranges: { name: string; low: number; high: number }[] = [];

  for (const it of analysis.items) {
    const food = matchFood(it, foods);
    if (!food) {
      unmatched.push(it.name);
      continue;
    }
    const grams = resolveGrams(it, food);
    items.push({
      id: `ai-${items.length}-${Date.now().toString(36)}`,
      foodId: food.id,
      foodName: food.name,
      quantity: grams,
      unit: food.unit,
      grams,
      // Una foto nunca produce un dato exacto.
      confidence: confidenceOf(it),
      nutrients: scaleNutrients(food.per100g, grams),
    });
    ranges.push({ name: food.name, low: Math.round(it.grams_low), high: Math.round(it.grams_high) });
  }
  return { items, notes: { unmatched, ranges } };
}

function confidenceOf(it: PlateItem): Confidence {
  if (it.confidence === 'alta') return 'estimated';
  return 'rough';
}

function resolveGrams(it: PlateItem, food: Food): number {
  // Si el modelo ha contado unidades y el alimento tiene ración unitaria, manda
  // el recuento: contar dos huevos es más fiable que estimar 110 g de huevo.
  if (it.countable_units != null && it.countable_units > 0) {
    const unit = food.portions.find((p) => /unidad|loncha|filete|bola|rebanada/.test(p.label.toLowerCase()));
    if (unit) return Math.round(it.countable_units * unit.grams);
  }
  return Math.max(1, Math.round(it.grams));
}

function matchFood(it: PlateItem, foods: Food[]): Food | null {
  const wantsRaw = it.state === 'crudo';
  for (const query of [it.match_hint, it.name]) {
    const results = searchFoods(query, foods, 8);
    if (!results.length) continue;
    // Se prefiere el estado que dice la foto: cocinado salvo que diga crudo.
    const byState = results.find((f) => (wantsRaw ? f.state === 'raw' : f.state !== 'raw'));
    return byState ?? results[0];
  }
  return null;
}
