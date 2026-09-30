import { useEffect, useRef, useState } from 'react';
import { scaleNutrients } from '../../domain/nutrition';
import type { Food } from '../../domain/types';
import { EstimateNotice, Field, NumberInput, Sheet } from '../../ui/components';
import { useApp } from '../store';
import { ConfirmEntry } from './ConfirmEntry';
import { closeCamera, openCamera, startScanning, type ScanHandle } from './barcode';
import { lookupBarcode, OffLookupError, type BarcodeLookup } from './openfoodfacts';
import { FoodEditor } from './FoodEditor';

/**
 * Escáner de códigos de barras.
 *
 * Flujo: cámara → código → consulta en Open Food Facts → revisión de valores →
 * elegir cantidad → registrar. Si el producto no está en la base o le faltan
 * datos, se abre el editor para completarlo a mano; queda guardado para siempre.
 */
export function BarcodeScan({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const handleRef = useRef<ScanHandle | null>(null);

  const [status, setStatus] = useState<'starting' | 'scanning' | 'looking' | 'done' | 'error'>('starting');
  const [error, setError] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [manualCode, setManualCode] = useState('');
  const [lookup, setLookup] = useState<BarcodeLookup | null>(null);
  const [food, setFood] = useState<Food | null>(null);
  const [grams, setGrams] = useState<number | ''>(100);
  const [editing, setEditing] = useState(false);

  const stopAll = () => {
    handleRef.current?.stop();
    closeCamera(streamRef.current);
    streamRef.current = null;
  };

  useEffect(() => stopAll, []);

  const onFound = async (value: string) => {
    setCode(value);
    stopAll();
    setStatus('looking');
    try {
      const existing = app.foods.find((f) => f.barcode === value.replace(/\D/g, ''));
      if (existing) {
        setFood(existing);
        setGrams(existing.portions.find((p) => p.isDefault)?.grams ?? 100);
        setLookup({ found: true, food: existing, missing: [] });
        setStatus('done');
        return;
      }
      const result = await lookupBarcode(value);
      setLookup(result);
      if (result.food) {
        setFood(result.food);
        setGrams(result.food.portions.find((p) => p.isDefault)?.grams ?? 100);
      }
      setStatus('done');
    } catch (err) {
      setError(err instanceof OffLookupError ? err.message : 'No se ha podido consultar el producto.');
      setStatus('error');
    }
  };

  const startCamera = async () => {
    setError(null);
    setStatus('starting');
    const video = videoRef.current;
    if (!video) return;
    try {
      streamRef.current = await openCamera(video);
      handleRef.current = await startScanning(video, (c) => void onFound(c), (m) => {
        setError(m);
        setStatus('error');
      });
      setStatus('scanning');
    } catch (err) {
      setError(
        err instanceof Error && /Permission|NotAllowed|denied/i.test(err.message)
          ? 'No hay permiso para usar la cámara. Puedes escribir el código a mano.'
          : 'No se ha podido abrir la cámara. Puedes escribir el código a mano.',
      );
      setStatus('error');
    }
  };

  // ── Editor de alimento: producto nuevo o con datos incompletos ──
  if (editing) {
    return (
      <FoodEditor
        initial={food ?? blankProduct(code)}
        title={food ? 'Revisar el producto' : 'Nuevo producto'}
        onCancel={() => setEditing(false)}
        onSaved={(saved: Food) => {
          setFood(saved);
          setLookup({ found: true, food: saved, missing: [] });
          setEditing(false);
        }}
      />
    );
  }

  // ── Producto listo: elegir ración y registrar ──
  if (status === 'done' && food) {
    const gramsValue = grams === '' ? 0 : grams;
    const nutrients = scaleNutrients(food.per100g, gramsValue);
    if (gramsValue > 0 && lookup?.missing.length === 0) {
      return (
        <ConfirmEntry
          title={food.name}
          subtitle={food.brand}
          initialItems={[{
            id: `bc-${Date.now().toString(36)}`,
            foodId: food.id,
            foodName: food.name,
            quantity: gramsValue,
            unit: food.unit,
            grams: gramsValue,
            confidence: 'exact',
            nutrients,
          }]}
          method="barcode"
          sourceNote={`Código de barras ${code}`}
          onClose={onClose}
          notice={
            <EstimateNotice>
              Los datos vienen de <b>Open Food Facts</b>, una base abierta y colaborativa. Suelen ser correctos,
              pero los introducen personas: si algo no cuadra con el envase, corrígelo.
            </EstimateNotice>
          }
        />
      );
    }
    return (
      <Sheet
        title={food.name}
        subtitle={food.brand}
        onClose={onClose}
        footer={
          <div className="btn-row">
            <button className="btn ghost" onClick={() => setEditing(true)}>Completar datos</button>
            <button className="btn primary" disabled={!lookup?.missing.length} onClick={() => setEditing(true)}>
              Continuar
            </button>
          </div>
        }
      >
        <div className="estimate">
          <span aria-hidden="true">⚠️</span>
          <div>
            A este producto le faltan datos en la base: <b>{lookup?.missing.join(', ')}</b>. Hay que completarlos
            mirando el envase; no se pueden suponer.
          </div>
        </div>
        <Field label="Cantidad">
          <NumberInput value={grams} suffix={food.unit} onChange={setGrams} step={10} />
        </Field>
      </Sheet>
    );
  }

  // ── Producto no encontrado ──
  if (status === 'done' && !food) {
    return (
      <Sheet title="Producto no encontrado" onClose={onClose}
        footer={<button className="btn primary" onClick={() => setEditing(true)}>Crearlo a mano</button>}>
        <div className="empty">
          <span className="ico" aria-hidden="true">🔍</span>
          El código <b>{code}</b> no está en Open Food Facts.
        </div>
        <p className="note">
          Puedes crearlo copiando la tabla del envase. Se guarda en tu dispositivo y la próxima vez que lo
          escanees aparecerá al instante.
        </p>
      </Sheet>
    );
  }

  // ── Cámara y entrada manual ──
  return (
    <Sheet
      title="📦 Escanear código"
      subtitle={status === 'scanning' ? 'Apunta al código de barras' : undefined}
      onClose={onClose}
      footer={
        <div className="btn-row">
          <button className="btn ghost" onClick={() => void startCamera()}>
            {status === 'error' ? 'Reintentar cámara' : 'Abrir cámara'}
          </button>
          <button className="btn primary" disabled={manualCode.replace(/\D/g, '').length < 8}
            onClick={() => void onFound(manualCode)}>
            Buscar código
          </button>
        </div>
      }
    >
      <video ref={videoRef} className="cam" muted playsInline />

      {status === 'looking' && (
        <p className="note" style={{ textAlign: 'center', marginTop: 12 }}>
          <span className="spinner" /> Buscando {code} en Open Food Facts…
        </p>
      )}
      {error && (
        <div className="estimate" style={{ marginTop: 12, borderColor: 'var(--bad)' }}>
          <span aria-hidden="true">⚠️</span>
          <div>{error}</div>
        </div>
      )}

      <div className="field" style={{ marginTop: 14 }}>
        <label>O escribe el código</label>
        <input className="input" inputMode="numeric" value={manualCode} placeholder="8410000000000"
          onChange={(e) => setManualCode(e.target.value)} />
        <div className="hint">Los códigos EAN de los productos españoles empiezan por 84.</div>
      </div>

      <p className="note">
        La lectura del código se hace en tu dispositivo. Solo el número, sin la imagen, se envía a Open Food
        Facts para buscar el producto.
      </p>
      <p className="note" style={{ marginBottom: 0 }}>
        {app.foods.filter((f) => f.barcode).length > 0 &&
          `Ya tienes ${app.foods.filter((f) => f.barcode).length} productos escaneados guardados: esos funcionan sin conexión.`}
      </p>
    </Sheet>
  );
}

export function blankProduct(barcode: string): Food {
  return {
    id: `custom-${Date.now().toString(36)}`,
    name: '',
    aliases: [],
    barcode: barcode.replace(/\D/g, '') || undefined,
    state: 'product',
    category: 'other',
    proteinSource: 'none',
    per100g: { kcal: 0, protein: 0, carbs: 0, fat: 0, fiber: 0, satFat: 0, sugars: 0, sodium: 0 },
    unit: 'g',
    portions: [{ label: '100 g', grams: 100, isDefault: true }],
    fermentability: 'low',
    volumeIndex: 'medium',
    custom: true,
    createdAt: Date.now(),
  };
}
