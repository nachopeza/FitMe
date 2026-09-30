import { useRef, useState } from 'react';
import type { Food } from '../../domain/types';
import { Sheet } from '../../ui/components';
import { useUI } from '../../ui/shell';
import { useApp } from '../store';
import { payloadToDataUrl, prepareImage } from './image';
import { describeAiError, readLabel } from './aiClient';
import { parseNutritionLabel } from './labelParser';
import { blankProduct } from './BarcodeScan';
import { FoodEditor } from './FoodEditor';

/**
 * Lectura de la tabla nutricional de una etiqueta.
 *
 * Decisión de diseño: la parte difícil —interpretar la tabla— la hace un parser
 * local y determinista (`labelParser`), no la IA. La IA solo transcribe la imagen
 * a texto. Eso significa que hay tres caminos hacia el mismo resultado y ninguno
 * es obligatorio:
 *
 *   1. Foto + IA (si el usuario ha configurado su clave): automático.
 *   2. Foto + escribir la tabla mirándola: siempre funciona, sin conexión.
 *   3. Pegar el texto de la tabla desde cualquier sitio.
 *
 * Todo pasa por el mismo extractor y por la misma revisión antes de guardar.
 */
export function LabelScan({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const ui = useUI();
  const fileInput = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [payload, setPayload] = useState<Awaited<ReturnType<typeof prepareImage>> | null>(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Food | null>(null);

  const aiReady = app.settings.aiProvider === 'anthropic' && !!app.settings.aiApiKey;

  const pick = async (file: File) => {
    setError(null);
    try {
      const prepared = await prepareImage(file, 1400);
      setPayload(prepared);
      setPreview(payloadToDataUrl(prepared));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'No se ha podido leer la imagen.');
    }
  };

  const transcribeWithAi = async () => {
    if (!payload) return;
    setBusy(true);
    setError(null);
    try {
      const result = await readLabel(payload, { apiKey: app.settings.aiApiKey, model: app.settings.aiModel });
      if (result.unreadable) {
        setError('La etiqueta no se lee con fiabilidad en esta foto. Prueba con más luz o escribe los valores.');
        return;
      }
      setText(result.raw_table_text);
      buildDraft(result.raw_table_text, result.product_name ?? '', result.brand ?? '', result.serving_grams);
    } catch (err) {
      setError(describeAiError(err));
    } finally {
      setBusy(false);
    }
  };

  const buildDraft = (raw: string, name = '', brand = '', serving?: number | null) => {
    const reading = parseNutritionLabel(raw);
    const base = blankProduct('');
    const food: Food = {
      ...base,
      name,
      brand: brand || undefined,
      per100g: { ...base.per100g, ...reading.per100g },
      portions:
        serving || reading.servingGrams
          ? [
              { label: 'ración', grams: Math.round((serving ?? reading.servingGrams)!), isDefault: true },
              { label: '100 g', grams: 100 },
            ]
          : base.portions,
    };
    setDraft(food);
  };

  if (draft) {
    return (
      <FoodEditor
        initial={draft}
        title="Revisar lo leído"
        onCancel={() => setDraft(null)}
        onSaved={(food) => {
          ui.notify(`"${food.name}" ya está en tu base de alimentos.`);
          onClose();
        }}
      />
    );
  }

  return (
    <Sheet
      title="🏷️ Escanear etiqueta"
      subtitle="Crea un alimento a partir de su tabla nutricional"
      onClose={onClose}
      footer={
        <div className="btn-row">
          {aiReady && payload ? (
            <button className="btn ghost" disabled={busy} onClick={() => void transcribeWithAi()}>
              {busy ? <span className="spinner" /> : 'Leer con IA'}
            </button>
          ) : (
            <button className="btn ghost" onClick={() => fileInput.current?.click()}>Hacer foto</button>
          )}
          <button className="btn primary" disabled={!text.trim()} onClick={() => buildDraft(text)}>
            Extraer valores
          </button>
        </div>
      }
    >
      <input ref={fileInput} type="file" accept="image/*" capture="environment" className="sr-only"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) void pick(f); e.target.value = ''; }} />

      {preview ? (
        <>
          <img className="preview" src={preview} alt="Foto de la etiqueta" />
          <div className="btn-row" style={{ marginTop: 10 }}>
            <button className="btn ghost sm" onClick={() => { setPreview(null); setPayload(null); }}>Cambiar foto</button>
            <button className="btn ghost sm" onClick={() => fileInput.current?.click()}>Otra foto</button>
          </div>
        </>
      ) : (
        <button className="btn" onClick={() => fileInput.current?.click()}>📷 Fotografiar la etiqueta</button>
      )}

      {error && (
        <div className="estimate" style={{ marginTop: 12, borderColor: 'var(--bad)' }}>
          <span aria-hidden="true">⚠️</span><div>{error}</div>
        </div>
      )}

      <div className="field" style={{ marginTop: 14 }}>
        <label>Tabla nutricional</label>
        <textarea className="input" rows={8} value={text} onChange={(e) => setText(e.target.value)}
          placeholder={'Valor energético 1502 kJ / 359 kcal\nGrasas 1,5 g\nde las cuales saturadas 0,3 g\nHidratos de carbono 71 g\nde los cuales azúcares 3 g\nFibra alimentaria 3,2 g\nProteínas 12,5 g\nSal 0,02 g'} />
        <div className="hint">
          Mirando la foto, copia la tabla tal cual. Entiende kJ y kcal, la coma decimal, «de las cuales
          saturadas» y las etiquetas de dos columnas (toma siempre la de 100 g).
        </div>
      </div>

      {!aiReady && (
        <p className="note">
          La transcripción automática necesita el análisis con IA activado (<b>Perfil → Análisis de fotos con
          IA</b>). Sin él, la foto sigue sirviendo: tenerla en pantalla mientras copias evita errores, y el
          extractor de valores funciona igual.
        </p>
      )}
    </Sheet>
  );
}
