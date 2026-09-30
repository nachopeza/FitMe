import { useMemo, useState } from 'react';
import { searchFoods } from '../../domain/parser';
import { MEAL_SLOT_LABEL, type Food, type LoggedItem, type MealSlot } from '../../domain/types';
import { Sheet, g } from '../../ui/components';
import { useApp } from '../store';
import { itemsFromParsed, makeItem } from '../logging';
import type { ParsedItem } from '../../domain/parser';
import { ConfirmEntry } from './ConfirmEntry';

/**
 * Registro manual: buscador de alimentos y salto directo a la confirmación.
 * Comparte la pantalla de confirmación con la voz y la foto, así que editar
 * cantidades funciona igual en todas las vías.
 */
export function ManualLog({
  onClose, slot, prefill, sourceNote, method = 'manual',
}: {
  onClose: () => void;
  slot?: MealSlot;
  prefill?: ParsedItem[];
  sourceNote?: string;
  method?: LoggedItem extends never ? never : 'manual' | 'voice' | 'photo' | 'saved' | 'recipe';
}) {
  const app = useApp();
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<LoggedItem[]>(() =>
    prefill ? itemsFromParsed(prefill, app.foodsById) : [],
  );
  const [confirming, setConfirming] = useState(!!prefill?.length);

  const results = useMemo(() => {
    if (query.trim().length < 2) {
      // Sin búsqueda, se ofrecen los alimentos que el usuario marcó como habituales.
      const pantry = app.profile?.pantryFoodIds ?? [];
      return pantry.map((id) => app.foodsById.get(id)).filter((f): f is Food => !!f).slice(0, 20);
    }
    return searchFoods(query, app.foods, 25);
  }, [query, app.foods, app.foodsById, app.profile]);

  const add = (food: Food) => {
    const portion = food.portions.find((p) => p.isDefault) ?? food.portions[0];
    setPicked((prev) => [...prev, makeItem(food, 1, 'portion', { portionLabel: portion?.label })]);
  };

  if (confirming) {
    return (
      <ConfirmEntry
        title="Revisar y guardar"
        subtitle={slot ? MEAL_SLOT_LABEL[slot] : undefined}
        initialItems={picked}
        sourceNote={sourceNote}
        method={method}
        slot={slot}
        onClose={onClose}
      />
    );
  }

  return (
    <Sheet
      title="✍️ Añadir a mano"
      subtitle="Busca y toca para añadir"
      onClose={onClose}
      footer={
        <button className="btn primary" disabled={!picked.length} onClick={() => setConfirming(true)}>
          Continuar con {picked.length} {picked.length === 1 ? 'alimento' : 'alimentos'}
        </button>
      }
    >
      <input className="input" value={query} onChange={(e) => setQuery(e.target.value)} autoFocus
        placeholder="Buscar: arroz, pollo, huevos…" aria-label="Buscar alimento" />

      {picked.length > 0 && (
        <div className="chips" style={{ marginTop: 12 }}>
          {picked.map((p) => (
            <button key={p.id} className="chip" aria-pressed
              onClick={() => setPicked((prev) => prev.filter((x) => x.id !== p.id))}>
              {p.foodName.replace(/\([^)]*\)/g, '').trim()} ✕
            </button>
          ))}
        </div>
      )}

      {query.trim().length < 2 && (app.profile?.pantryFoodIds.length ?? 0) > 0 && (
        <div className="card-title" style={{ marginTop: 16 }}><span>Tus alimentos habituales</span></div>
      )}

      <div className="list" style={{ marginTop: 8 }}>
        {results.map((f) => (
          <button className="row" key={f.id} onClick={() => add(f)}>
            <div className="row-main">
              <div className="row-title">{f.name}{f.brand ? ` · ${f.brand}` : ''}</div>
              <div className="row-sub">
                {g(f.per100g.kcal)} kcal · {g(f.per100g.protein)} g prot · {g(f.per100g.carbs)} g carb por 100 {f.unit}
              </div>
            </div>
            <span aria-hidden="true">+</span>
          </button>
        ))}
      </div>

      {query.trim().length >= 2 && results.length === 0 && (
        <div className="empty">
          <span className="ico" aria-hidden="true">🔍</span>
          No hay nada con ese nombre.
          <br />Puedes crearlo desde + → Etiqueta o + → Código de barras.
        </div>
      )}
    </Sheet>
  );
}
