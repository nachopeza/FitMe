import { EMPTY_NUTRIENTS, type Food } from '../../domain/types';
import { Sheet } from '../../ui/components';
import { useUI } from '../../ui/shell';
import { FoodEditor } from '../capture/FoodEditor';
import { useApp } from '../store';

/** Un alimento en blanco, listo para rellenar con lo que ponga el envase. */
export function blankFood(name = ''): Food {
  return {
    id: `f-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    name,
    aliases: [],
    state: 'product',
    category: 'other',
    proteinSource: 'none',
    per100g: { ...EMPTY_NUTRIENTS },
    unit: 'g',
    portions: [{ label: 'ración', grams: 100, isDefault: true }],
    custom: true,
  };
}

/**
 * Crear o corregir un alimento.
 *
 * Sin id es un producto nuevo —el típico paquete del super que no está en
 * ninguna base— y con id se corrige uno que ya existe, incluidos los del
 * catálogo: sus valores son los de su producto y los nuestros, una referencia.
 */
export function FoodEditSheet({
  id, name, onClose,
}: { id?: string; name?: string; onClose: () => void }) {
  const app = useApp();
  const ui = useUI();
  const existing = id ? app.foodsById.get(id) : undefined;

  if (id && !existing) {
    return (
      <Sheet title="Alimento" onClose={onClose}>
        <p className="note">Ese alimento ya no está en tu base de datos.</p>
      </Sheet>
    );
  }

  return (
    <FoodEditor
      initial={existing ?? blankFood(name)}
      mode={existing ? 'edit' : 'create'}
      title={existing ? `Corregir ${existing.name}` : 'Nuevo alimento'}
      onCancel={onClose}
      onSaved={(food) => {
        onClose();
        // Al crearlo se abre el registro: lo normal es que lo esté comiendo ya.
        if (!existing) ui.open({ k: 'manual', prefill: [{
          foodId: food.id,
          foodName: food.name,
          quantity: 1,
          unit: 'portion',
          portionLabel: food.portions.find((p) => p.isDefault)?.label,
          grams: food.portions.find((p) => p.isDefault)?.grams ?? 100,
          confidence: 'exact',
          source: food.name,
        }] });
      }}
    />
  );
}
