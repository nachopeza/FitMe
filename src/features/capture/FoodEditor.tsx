import { useMemo, useState } from 'react';
import { energyFromMacros, energyMismatchKcal } from '../../domain/nutrition';
import type { Food, FoodCategory, FoodState, ProteinSource } from '../../domain/types';
import { Field, NumberInput, Sheet } from '../../ui/components';
import { useUI } from '../../ui/shell';
import { useApp } from '../store';
import { validateLabel } from './labelParser';

const STATE_LABEL: Record<FoodState, string> = {
  raw: 'Crudo (sin cocinar)',
  cooked: 'Cocinado',
  product: 'Producto envasado',
  asIs: 'Se come tal cual',
};

const CATEGORY_LABEL: Record<FoodCategory, string> = {
  protein: 'Proteína', carb: 'Carbohidrato', vegetable: 'Verdura', fruit: 'Fruta',
  dairy: 'Lácteo o alternativa', fat: 'Grasa', drink: 'Bebida', other: 'Otro',
};

const SOURCE_LABEL: Record<ProteinSource, string> = {
  egg: 'Huevo', poultry: 'Ave', redMeat: 'Carne roja', fish: 'Pescado o marisco',
  dairy: 'Lácteo', soy: 'Soja', legume: 'Legumbre', cereal: 'Cereal',
  supplement: 'Suplemento', none: 'No es fuente de proteína',
};

/**
 * Editor de alimentos personalizados.
 *
 * Todos los valores son por 100 g o 100 ml, igual que las etiquetas europeas,
 * y con el mismo convenio: los hidratos de carbono NO incluyen la fibra.
 * Se avisa cuando la energía declarada no cuadra con los macros, porque casi
 * siempre significa que se ha copiado la columna de la ración por error.
 */
export function FoodEditor({
  initial, title = 'Nuevo alimento', onSaved, onCancel,
}: {
  initial: Food;
  title?: string;
  onSaved: (food: Food) => void;
  onCancel: () => void;
}) {
  const app = useApp();
  const ui = useUI();
  const [f, setF] = useState<Food>(initial);
  const [servingGrams, setServingGrams] = useState<number | ''>(
    initial.portions.find((p) => p.label === 'ración')?.grams ?? '',
  );

  const set = <K extends keyof Food>(k: K, v: Food[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const setN = (k: keyof Food['per100g'], v: number | '') =>
    setF((prev) => ({ ...prev, per100g: { ...prev.per100g, [k]: v === '' ? 0 : v } }));

  const problems = useMemo(() => validateLabel(f.per100g), [f.per100g]);
  const computed = Math.round(energyFromMacros(f.per100g));
  const drift = Math.round(energyMismatchKcal(f.per100g));

  const canSave = f.name.trim().length >= 2 && f.per100g.kcal > 0;

  const save = async () => {
    const portions = [
      ...(servingGrams !== '' && servingGrams > 0
        ? [{ label: 'ración', grams: Math.round(servingGrams), isDefault: true }]
        : []),
      { label: f.unit === 'ml' ? '100 ml' : '100 g', grams: 100, isDefault: !(servingGrams !== '' && servingGrams > 0) },
    ];
    const saved: Food = {
      ...f,
      name: f.name.trim(),
      aliases: [...new Set([f.name.trim().toLowerCase(), ...f.aliases].filter(Boolean))],
      portions,
      custom: true,
      createdAt: f.createdAt ?? Date.now(),
    };
    await app.actions.upsertFood(saved);
    ui.notify('Alimento guardado en tu base de datos.');
    onSaved(saved);
  };

  return (
    <Sheet
      title={title}
      subtitle="Valores por 100 g, como en la etiqueta"
      onClose={onCancel}
      footer={
        <div className="btn-row">
          <button className="btn ghost" onClick={onCancel}>Cancelar</button>
          <button className="btn primary" disabled={!canSave} onClick={() => void save()}>Guardar</button>
        </div>
      }
    >
      <Field label="Nombre">
        <input className="input" value={f.name} onChange={(e) => set('name', e.target.value)}
          placeholder="Yogur proteico de fresa" />
      </Field>
      <Field label="Marca (opcional)">
        <input className="input" value={f.brand ?? ''} onChange={(e) => set('brand', e.target.value || undefined)} />
      </Field>
      {f.barcode && (
        <Field label="Código de barras"><input className="input" value={f.barcode} readOnly /></Field>
      )}

      <div className="grid-2">
        <Field label="Estado">
          <select className="input" value={f.state} onChange={(e) => set('state', e.target.value as FoodState)}>
            {Object.entries(STATE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Unidad">
          <select className="input" value={f.unit} onChange={(e) => set('unit', e.target.value as 'g' | 'ml')}>
            <option value="g">Gramos</option>
            <option value="ml">Mililitros</option>
          </select>
        </Field>
      </div>
      <div className="grid-2">
        <Field label="Categoría">
          <select className="input" value={f.category} onChange={(e) => set('category', e.target.value as FoodCategory)}>
            {Object.entries(CATEGORY_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
        <Field label="Fuente de proteína">
          <select className="input" value={f.proteinSource}
            onChange={(e) => set('proteinSource', e.target.value as ProteinSource)}>
            {Object.entries(SOURCE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </Field>
      </div>

      <div className="card tight">
        <div className="card-title"><span>Por 100 {f.unit}</span></div>
        <Field label="Energía">
          <NumberInput value={f.per100g.kcal} suffix="kcal" onChange={(v) => setN('kcal', v)} />
        </Field>
        <div className="grid-2">
          <Field label="Proteínas">
            <NumberInput value={f.per100g.protein} step={0.1} suffix="g" onChange={(v) => setN('protein', v)} />
          </Field>
          <Field label="Grasas">
            <NumberInput value={f.per100g.fat} step={0.1} suffix="g" onChange={(v) => setN('fat', v)} />
          </Field>
          <Field label="Hidratos de carbono" >
            <NumberInput value={f.per100g.carbs} step={0.1} suffix="g" onChange={(v) => setN('carbs', v)} />
          </Field>
          <Field label="Fibra">
            <NumberInput value={f.per100g.fiber} step={0.1} suffix="g" onChange={(v) => setN('fiber', v)} />
          </Field>
          <Field label="De las cuales saturadas">
            <NumberInput value={f.per100g.satFat ?? 0} step={0.1} suffix="g" onChange={(v) => setN('satFat', v)} />
          </Field>
          <Field label="De los cuales azúcares">
            <NumberInput value={f.per100g.sugars ?? 0} step={0.1} suffix="g" onChange={(v) => setN('sugars', v)} />
          </Field>
        </div>
        <Field label="Sodio" hint="Si la etiqueta da sal en gramos, multiplícala por 400 para obtener los mg de sodio.">
          <NumberInput value={f.per100g.sodium ?? 0} suffix="mg" onChange={(v) => setN('sodium', v)} />
        </Field>
        <p className="hint" style={{ marginTop: 0 }}>
          Como en las etiquetas españolas, los hidratos de carbono van <b>sin</b> la fibra.
        </p>
      </div>

      <Field label="Tamaño de ración (opcional)" hint="Si lo pones, será la cantidad que se ofrezca por defecto.">
        <NumberInput value={servingGrams} suffix={f.unit} onChange={setServingGrams} />
      </Field>

      {/* Comprobación de coherencia: detecta el error más típico al copiar. */}
      {f.per100g.kcal > 0 && (
        <div className={problems.length ? 'estimate' : 'note-strong'} style={{ marginBottom: 12 }}>
          {problems.length ? (
            <>
              <span aria-hidden="true">⚠️</span>
              <div>
                <b>Revisa los valores:</b>
                <ul style={{ margin: '5px 0 0', paddingLeft: 16 }}>
                  {problems.map((p, i) => <li key={i}>{p}</li>)}
                </ul>
              </div>
            </>
          ) : (
            <span className="note">
              Coherente: los macros dan {computed} kcal y la etiqueta declara {Math.round(f.per100g.kcal)}
              {drift > 0 ? ` (${drift} kcal de diferencia, dentro de lo normal)` : ''}.
            </span>
          )}
        </div>
      )}
    </Sheet>
  );
}
