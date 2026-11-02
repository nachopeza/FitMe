import { useMemo, useState } from 'react';
import { normalize } from '../../domain/parser';
import type { Food } from '../../domain/types';
import { Sheet, g } from '../../ui/components';
import { Icon } from '../../ui/icons';
import { useApp } from '../store';

/**
 * Elegir un alimento del catálogo.
 *
 * Es el mismo gesto que el selector de ejercicios: buscar y tocar. Los que él
 * marcó como básicos salen primero, porque entre casi doscientos alimentos los
 * suyos son siempre los mismos quince.
 */
export function FoodPicker({
  title = 'Añadir alimento', onPick, onClose,
}: {
  title?: string;
  onPick: (food: Food) => void;
  onClose: () => void;
}) {
  const app = useApp();
  const [query, setQuery] = useState('');

  const resultados = useMemo(() => {
    const q = normalize(query);
    const basicos = new Set(app.profile?.basicFoodIds ?? []);
    return app.foods
      .filter((f) => {
        if (!q) return basicos.has(f.id) || f.custom;
        return [f.name, ...f.aliases].some((a) => normalize(a).includes(q));
      })
      .sort((a, b) => {
        const pa = (basicos.has(a.id) ? 0 : 1) - (basicos.has(b.id) ? 0 : 1);
        return pa !== 0 ? pa : a.name.localeCompare(b.name, 'es');
      })
      .slice(0, 60);
  }, [app.foods, app.profile?.basicFoodIds, query]);

  return (
    <Sheet title={title} onClose={onClose}>
      <input
        className="input"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Buscar: arroz, pollo, yogur…"
        aria-label="Buscar alimento"
        autoFocus
      />

      <div className="ex-list" style={{ marginTop: 14 }}>
        {resultados.map((f) => (
          <div className="ex-row" key={f.id}>
            <button className="ex-row-body" onClick={() => onPick(f)}>
              <span className="chip-ico sm c-kcal"><Icon name="plate" size={17} /></span>
              <span className="ex-row-text">
                <span className="ex-row-name">{f.name}</span>
                <span className="ex-row-muscle">
                  {g(f.per100g.kcal)} kcal · {g(f.per100g.protein)} g prot por 100 {f.unit}
                </span>
              </span>
            </button>
          </div>
        ))}
      </div>

      {resultados.length === 0 && (
        <div className="empty">
          <strong>{query ? 'No hay nada con ese nombre' : 'Empieza a escribir'}</strong>
          {query
            ? 'Prueba con otra palabra, o créalo desde Añadir → Producto nuevo.'
            : 'O marca tus básicos en el perfil para tenerlos siempre arriba.'}
        </div>
      )}
    </Sheet>
  );
}
