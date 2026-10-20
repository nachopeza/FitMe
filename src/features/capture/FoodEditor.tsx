import { useMemo, useState } from 'react';
import { energyFromMacros, energyMismatchKcal } from '../../domain/nutrition';
import type { Food, FoodCategory, FoodState, Portion, ProteinSource } from '../../domain/types';
import { Field, NumberInput, Sheet } from '../../ui/components';
import { Icon } from '../../ui/icons';
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
  initial, title = 'Nuevo alimento', mode = 'create', onSaved, onCancel,
}: {
  initial: Food;
  title?: string;
  /**
   * 'create' para un producto nuevo; 'edit' para corregir uno que ya existe,
   * donde hay que conservar sus raciones en lugar de rehacerlas.
   */
  mode?: 'create' | 'edit';
  onSaved: (food: Food) => void;
  onCancel: () => void;
}) {
  const app = useApp();
  const ui = useUI();
  const [f, setF] = useState<Food>(initial);
  const [portions, setPortions] = useState<Portion[]>(
    initial.portions.length
      ? initial.portions
      : [{ label: initial.unit === 'ml' ? '100 ml' : '100 g', grams: 100, isDefault: true }],
  );
  const [newPortion, setNewPortion] = useState('');

  const set = <K extends keyof Food>(k: K, v: Food[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const setN = (k: keyof Food['per100g'], v: number | '') =>
    setF((prev) => ({ ...prev, per100g: { ...prev.per100g, [k]: v === '' ? 0 : v } }));

  const problems = useMemo(() => validateLabel(f.per100g), [f.per100g]);
  const computed = Math.round(energyFromMacros(f.per100g));
  const drift = Math.round(energyMismatchKcal(f.per100g));

  const canSave = f.name.trim().length >= 2 && f.per100g.kcal > 0;

  const setPortionGrams = (label: string, grams: number | '') => {
    setPortions((prev) => prev.map((p) => (p.label === label ? { ...p, grams: grams === '' ? 0 : grams } : p)));
  };

  const makeDefault = (label: string) => {
    setPortions((prev) => prev.map((p) => ({ ...p, isDefault: p.label === label })));
  };

  const removePortion = (label: string) => {
    setPortions((prev) => {
      const left = prev.filter((p) => p.label !== label);
      // Siempre tiene que quedar una por defecto, o no se sabría qué ofrecer.
      if (left.length && !left.some((p) => p.isDefault)) left[0] = { ...left[0], isDefault: true };
      return left;
    });
  };

  const addPortion = () => {
    const label = newPortion.trim().toLowerCase();
    if (!label || portions.some((p) => p.label.toLowerCase() === label)) return;
    setPortions((prev) => [...prev, { label, grams: 100, isDefault: prev.length === 0 }]);
    setNewPortion('');
  };

  const save = async () => {
    const clean = portions
      .filter((p) => p.grams > 0)
      .map((p) => ({ ...p, label: p.label.trim(), grams: Math.round(p.grams) }));
    const withDefault = clean.some((p) => p.isDefault)
      ? clean
      : clean.map((p, i) => ({ ...p, isDefault: i === 0 }));
    const saved: Food = {
      ...f,
      name: f.name.trim(),
      aliases: [...new Set([f.name.trim().toLowerCase(), ...f.aliases].filter(Boolean))],
      portions: withDefault.length
        ? withDefault
        : [{ label: f.unit === 'ml' ? '100 ml' : '100 g', grams: 100, isDefault: true }],
      // Un alimento creado por él es suyo; uno del catálogo que corrige queda
      // marcado para que una actualización del catálogo no le pise los valores.
      custom: mode === 'create' ? true : f.custom,
      edited: mode === 'edit' ? true : f.edited,
      createdAt: f.createdAt ?? Date.now(),
    };
    await app.actions.upsertFood(saved);
    ui.notify(mode === 'edit' ? 'Alimento corregido.' : 'Alimento guardado en tu base de datos.');
    onSaved(saved);
  };

  return (
    <Sheet
      title={title}
      subtitle="Valores por 100 g, como en la etiqueta"
      onClose={onCancel}
      footer={
        <div className="btns">
          <button className="btn quiet" onClick={onCancel}>Cancelar</button>
          <button className="btn primary" disabled={!canSave} onClick={() => void save()}>Guardar</button>
        </div>
      }
    >
      <Field label="Nombre">
        <input className="input" aria-label="Nombre del alimento" value={f.name}
          onChange={(e) => set('name', e.target.value)} placeholder="Yogur proteico de fresa" />
      </Field>
      <Field label="Marca (opcional)">
        <input className="input" aria-label="Marca" value={f.brand ?? ''}
          onChange={(e) => set('brand', e.target.value || undefined)} />
      </Field>
      {f.barcode && (
        <Field label="Código de barras"><input className="input" value={f.barcode} readOnly /></Field>
      )}

      <div className="figures two">
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
      <div className="figures two">
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

      <div className="card">
        <div className="card-title"><span>Por 100 {f.unit}</span></div>
        <Field label="Energía">
          <NumberInput label="Energía" value={f.per100g.kcal} suffix="kcal" onChange={(v) => setN('kcal', v)} />
        </Field>
        <div className="figures two">
          <Field label="Proteínas">
            <NumberInput label="Proteínas" value={f.per100g.protein} step={0.1} suffix="g" onChange={(v) => setN('protein', v)} />
          </Field>
          <Field label="Grasas">
            <NumberInput label="Grasas" value={f.per100g.fat} step={0.1} suffix="g" onChange={(v) => setN('fat', v)} />
          </Field>
          <Field label="Hidratos de carbono" >
            <NumberInput label="Hidratos de carbono" value={f.per100g.carbs} step={0.1} suffix="g" onChange={(v) => setN('carbs', v)} />
          </Field>
          <Field label="Fibra">
            <NumberInput label="Fibra" value={f.per100g.fiber} step={0.1} suffix="g" onChange={(v) => setN('fiber', v)} />
          </Field>
          <Field label="De las cuales saturadas">
            <NumberInput label="Saturadas" value={f.per100g.satFat ?? 0} step={0.1} suffix="g" onChange={(v) => setN('satFat', v)} />
          </Field>
          <Field label="De los cuales azúcares">
            <NumberInput label="Azúcares" value={f.per100g.sugars ?? 0} step={0.1} suffix="g" onChange={(v) => setN('sugars', v)} />
          </Field>
        </div>
        <Field label="Sodio" hint="Si la etiqueta da sal en gramos, multiplícala por 400 para obtener los mg de sodio.">
          <NumberInput label="Sodio" value={f.per100g.sodium ?? 0} suffix="mg" onChange={(v) => setN('sodium', v)} />
        </Field>
        <p className="hint" style={{ marginTop: 0 }}>
          Como en las etiquetas españolas, los hidratos de carbono van <b>sin</b> la fibra.
        </p>
      </div>

      {/* Raciones: es lo que de verdad se usa al registrar, y lo que más falla
          si no coincide con cómo come uno. Por eso se editan aquí. */}
      <div className="card">
        <div className="card-title"><span>Raciones</span></div>
        <p className="hint" style={{ marginTop: 0 }}>
          La marcada es la que se ofrece por defecto al añadirlo de un toque.
        </p>
        {portions.map((p) => (
          <div className="portion-row" key={p.label}>
            <button
              className="chip"
              aria-pressed={p.isDefault}
              onClick={() => makeDefault(p.label)}
              aria-label={`Usar ${p.label} por defecto`}
            >
              {p.label}
            </button>
            <NumberInput
              value={p.grams}
              suffix={f.unit}
              onChange={(v) => setPortionGrams(p.label, v)}
              label={`Gramos de ${p.label}`}
            />
            {portions.length > 1 && (
              <button className="icon-btn" aria-label={`Quitar ${p.label}`} onClick={() => removePortion(p.label)}>
                <Icon name="trash" size={17} />
              </button>
            )}
          </div>
        ))}
        <div className="portion-row" style={{ marginTop: 6 }}>
          <input
            className="input"
            value={newPortion}
            onChange={(e) => setNewPortion(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') addPortion(); }}
            placeholder="unidad, plato, puñado…"
            aria-label="Nombre de la ración nueva"
          />
          <button className="btn sm auto" disabled={!newPortion.trim()} onClick={addPortion}>Añadir</button>
        </div>
      </div>

      {/* Comprobación de coherencia: detecta el error más típico al copiar. */}
      {f.per100g.kcal > 0 && (
        <div className={problems.length ? 'estimate' : 'note-strong'} style={{ marginBottom: 12 }}>
          {problems.length ? (
            <>
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
