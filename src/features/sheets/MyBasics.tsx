import { useMemo, useState } from 'react';
import { scaleNutrients } from '../../domain/nutrition';
import { normalize, searchFoods } from '../../domain/parser';
import type { Food } from '../../domain/types';
import { Sheet, g } from '../../ui/components';
import { useApp } from '../store';

/**
 * Sus básicos.
 *
 * Unos básicos predefinidos no son los de nadie: el café, el plátano y los
 * frutos secos de uno no son los del siguiente. Aquí elige los suyos y pasan a
 * ser casillas de un toque en HOY, con su ración por defecto.
 */
export function MyBasics({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const [query, setQuery] = useState('');
  const chosen = app.profile?.basicFoodIds ?? [];

  const picked = useMemo(
    () => chosen.map((id) => app.foodsById.get(id)).filter((f): f is Food => !!f),
    [chosen, app.foodsById],
  );

  const results = useMemo(() => {
    const q = normalize(query);
    if (q.length < 2) return [];
    return searchFoods(query, app.foods, 24).filter((f) => !chosen.includes(f.id));
  }, [query, app.foods, chosen]);

  const line = (f: Food) => {
    const portion = f.portions.find((p) => p.isDefault) ?? f.portions[0];
    const grams = portion?.grams ?? 100;
    const n = scaleNutrients(f.per100g, grams);
    return `${portion?.label ?? '100 g'} · ${g(n.kcal)} kcal · ${g(n.protein)} g prot`;
  };

  return (
    <Sheet
      title="Mis básicos"
      subtitle="Lo que comes a diario, a un toque"
      onClose={onClose}
      footer={<button className="btn primary" onClick={onClose}>Hecho</button>}
    >
      {picked.length > 0 ? (
        <div className="field">
          <span className="field-label">Tus básicos ({picked.length})</span>
          <div className="rows">
            {picked.map((f) => (
              <div className="row" key={f.id}>
                <div className="row-body">
                  <div className="row-name">{f.name}</div>
                  <div className="row-meta">{line(f)}</div>
                </div>
                <button
                  className="btn sm auto quiet"
                  onClick={() => void app.actions.toggleBasicFood(f.id)}
                >
                  Quitar
                </button>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="empty">
          <strong>Todavía no has elegido ninguno</strong>
          Busca abajo lo que comes casi todos los días —tu plátano, tus frutos secos, tu yogur— y
          aparecerá en Hoy para añadirlo de un toque.
        </div>
      )}

      <div className="field">
        <span className="field-label">Añadir uno</span>
        <input
          className="input"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Buscar: plátano, frutos secos, yogur…"
          aria-label="Buscar alimento"
        />
      </div>

      {results.length > 0 && (
        <div className="rows">
          {results.map((f) => (
            <button
              className="row"
              key={f.id}
              onClick={() => {
                void app.actions.toggleBasicFood(f.id);
                setQuery('');
              }}
            >
              <div className="row-body">
                <div className="row-name">{f.name}</div>
                <div className="row-meta">{line(f)}</div>
              </div>
              <span className="tag">Añadir</span>
            </button>
          ))}
        </div>
      )}

      <p className="note tight">
        Al tocar un básico en Hoy se registra su ración por defecto. Si ese día comes otra
        cantidad, se puede corregir desde el registro del día.
      </p>
    </Sheet>
  );
}
