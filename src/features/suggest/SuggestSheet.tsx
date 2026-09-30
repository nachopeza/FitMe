import { useMemo, useState } from 'react';
import { nowTime } from '../../domain/dates';
import { searchFoods } from '../../domain/parser';
import { scaleNutrients } from '../../domain/nutrition';
import { recommendMeals } from '../../domain/recommender';
import type { Food, LoggedItem, MealSuggestion, SuggestionContext } from '../../domain/types';
import { EstimateNotice, MACRO_META, MacroPills, Sheet, g } from '../../ui/components';
import { useUI } from '../../ui/shell';
import { slotForTime, useApp } from '../store';
import { foodIdsUsed } from '../logging';
import { ConfirmEntry } from '../capture/ConfirmEntry';

type Mode = 'normal' | 'quick' | 'noCook';

const MODE_TITLE: Record<Mode, string> = {
  normal: '🍽️ ¿Qué como ahora?',
  quick: '⚡ Cena rápida',
  noCook: '😴 No quiero cocinar',
};

const MODE_SUB: Record<Mode, string> = {
  normal: 'Tres opciones que encajan con lo que te queda hoy',
  quick: 'Comidas de 12 minutos o menos',
  noCook: 'Sin cocinar, listo en 5 minutos',
};

export function SuggestSheet({
  onClose, mode: initialMode, pantry: initialPantry, title,
}: {
  onClose: () => void;
  mode: Mode;
  pantry?: boolean;
  title?: string;
}) {
  const app = useApp();
  const ui = useUI();
  const [mode, setMode] = useState<Mode>(initialMode);
  const [pantryMode, setPantryMode] = useState(!!initialPantry);
  const [pantryText, setPantryText] = useState('');
  const [chosen, setChosen] = useState<MealSuggestion | null>(null);

  /** Alimentos disponibles según lo que el usuario escriba en "tengo esto en casa". */
  const availableFoodIds = useMemo(() => {
    if (!pantryMode) return undefined;
    const typed = pantryText
      .split(/,|\n/)
      .map((s) => s.trim())
      .filter((s) => s.length >= 2)
      .flatMap((term) => searchFoods(term, app.foods, 2).map((f) => f.id));
    // Si no ha escrito nada, se usan sus alimentos habituales del perfil.
    const base = typed.length ? typed : (app.profile?.pantryFoodIds ?? []);
    return [...new Set(base)];
  }, [pantryMode, pantryText, app.foods, app.profile]);

  const ctx: SuggestionContext = useMemo(
    () => ({
      remaining: app.remaining,
      targets: app.targets,
      consumed: app.consumed,
      dayType: app.dayType,
      hunger: app.day?.hunger ?? app.profile?.appetite ?? 'normal',
      digestion: app.day?.digestion ?? 'good',
      now: nowTime(),
      slot: slotForTime(nowTime(), app.profile?.mealTimes ?? {}),
      trained: !!app.day?.training,
      availableFoodIds,
      mode,
      restrictions: app.profile?.restrictions ?? [],
      dislikes: app.profile?.dislikes ?? [],
    }),
    [app.remaining, app.targets, app.consumed, app.dayType, app.day, app.profile, availableFoodIds, mode],
  );

  const suggestions = useMemo(
    () =>
      recommendMeals({
        ctx,
        foods: app.foodsById,
        savedMeals: app.savedMeals,
        recipes: app.recipes,
        recentFoodIds: foodIdsUsed(app.entries),
        limit: 3,
      }),
    [ctx, app.foodsById, app.savedMeals, app.recipes, app.entries],
  );

  if (chosen) {
    const items: LoggedItem[] = chosen.items
      .map((i, idx): LoggedItem | null => {
        const food = app.foodsById.get(i.foodId);
        if (!food) return null;
        return {
          id: `s-${idx}-${Date.now().toString(36)}`,
          foodId: food.id,
          foodName: food.name,
          quantity: i.grams,
          unit: food.unit,
          grams: i.grams,
          // Es una propuesta calculada; lo que se coma de verdad puede variar.
          confidence: 'estimated' as const,
          nutrients: scaleNutrients(food.per100g, i.grams),
        };
      })
      .filter((x): x is LoggedItem => !!x);

    return (
      <ConfirmEntry
        title={chosen.title}
        subtitle="Ajusta las cantidades a lo que realmente te sirvas"
        initialItems={items}
        method={chosen.recipeId ? 'recipe' : chosen.savedMealId ? 'saved' : 'manual'}
        recipeId={chosen.recipeId}
        slot={ctx.slot}
        onClose={async () => {
          if (chosen.savedMealId) await app.actions.markSavedMealUsed(chosen.savedMealId);
          onClose();
        }}
        notice={
          <EstimateNotice>
            Es una propuesta calculada sobre lo que te falta hoy. Las cantidades son orientativas: sírvete lo
            que te apetezca y corrígelas aquí.
          </EstimateNotice>
        }
      />
    );
  }

  const nothingLeft = app.remaining.kcal < 100 && app.remaining.protein < 8;

  return (
    <Sheet title={title ?? MODE_TITLE[mode]} subtitle={MODE_SUB[mode]} onClose={onClose}>
      {/* ── Lo que falta: es la base de todo lo que viene debajo ── */}
      <div className="card tight">
        <div className="card-title"><span>Te queda hoy</span></div>
        <div className="grid-3">
          {(['kcal', 'protein', 'carbs'] as const).map((k) => (
            <div className="stat" key={k}>
              <div className="stat-label">{MACRO_META[k].icon} {MACRO_META[k].short}</div>
              <div className="stat-value">{g(Math.max(0, app.remaining[k]))}</div>
            </div>
          ))}
        </div>
        <p className="note" style={{ marginTop: 8, marginBottom: 0 }}>
          {describeContext(ctx)}
        </p>
      </div>

      {/* ── Modos ── */}
      <div className="chips" style={{ marginBottom: 12 }}>
        {(['normal', 'quick', 'noCook'] as Mode[]).map((m) => (
          <button key={m} className="chip" aria-pressed={mode === m} onClick={() => setMode(m)}>
            {m === 'normal' ? 'Normal' : m === 'quick' ? '⚡ Rápido' : '😴 Sin cocinar'}
          </button>
        ))}
        <button className="chip" aria-pressed={pantryMode} onClick={() => setPantryMode((v) => !v)}>
          🏠 Tengo esto en casa
        </button>
      </div>

      {pantryMode && (
        <div className="card tight">
          <div className="card-title"><span>Qué tienes en casa</span></div>
          <textarea className="input" rows={3} value={pantryText} onChange={(e) => setPantryText(e.target.value)}
            placeholder="arroz, huevos, atún, tomate, yogur, pollo" />
          <div className="hint">
            Uno por línea o separados por comas. Si lo dejas vacío, se usan los alimentos que marcaste como
            habituales en tu perfil. El aceite, la sal y el café se dan por supuestos.
          </div>
        </div>
      )}

      {/* ── Propuestas ── */}
      {nothingLeft && (
        <div className="estimate" style={{ marginBottom: 12 }}>
          <span aria-hidden="true">✓</span>
          <div>
            Hoy ya has cubierto prácticamente tus objetivos. Si tienes hambre, come: un día por encima no
            estropea nada. Estas opciones son pequeñas a propósito.
          </div>
        </div>
      )}

      {suggestions.length === 0 ? (
        <div className="empty">
          <span className="ico" aria-hidden="true">🤔</span>
          No encuentro nada que encaje con estas condiciones.
          {pantryMode && <><br />Prueba a añadir algún alimento más a la lista.</>}
          {mode === 'noCook' && <><br />O permite cocinar algo (modo Normal o Rápido).</>}
        </div>
      ) : (
        suggestions.map((s, i) => <SuggestionCard key={s.id} s={s} index={i} onPick={() => setChosen(s)} foods={app.foodsById} />)
      )}

      <p className="note" style={{ marginTop: 6 }}>
        Las propuestas se ordenan por lo que más te falta, en este orden: proteína, energía, reparto de
        carbohidratos y grasa, fibra, entrenamiento, apetito, digestión, lo que tienes en casa y facilidad.
      </p>
      <button className="btn ghost sm" onClick={() => { onClose(); ui.open({ k: 'dayState' }); }}>
        Cambiar hambre o digestión de hoy
      </button>
    </Sheet>
  );
}

function SuggestionCard({
  s, index, onPick, foods,
}: { s: MealSuggestion; index: number; onPick: () => void; foods: Map<string, Food> }) {
  const [why, setWhy] = useState(false);
  return (
    <div className="sugg">
      <div className="sugg-head">
        <div>
          <div className="screen-sub" style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            Opción {index + 1}
          </div>
          <div className="sugg-title">{s.title}</div>
        </div>
        <span className="tag">{s.prepMinutes <= 5 ? 'Sin cocinar' : `${s.prepMinutes} min`}</span>
      </div>

      <MacroPills n={s.nutrients} />

      <div className="sugg-items">
        {s.items.map((i) => {
          const food = foods.get(i.foodId);
          return (
            <div key={i.foodId}>
              · {food?.name.replace(/\([^)]*\)/g, '').trim() ?? i.foodName} — {i.grams} {i.unit}
            </div>
          );
        })}
      </div>

      {s.why.length > 0 && (
        <>
          <button className="link-btn" onClick={() => setWhy((v) => !v)} aria-expanded={why}>
            {why ? 'Ocultar explicación' : '¿Por qué?'}
          </button>
          {why && (
            <div className="sugg-why" style={{ marginTop: 8 }}>
              <ul>{s.why.map((w, i) => <li key={i}>{w}</li>)}</ul>
            </div>
          )}
        </>
      )}

      <button className="btn primary sm" style={{ marginTop: 10 }} onClick={onPick}>Registrar esta</button>
    </div>
  );
}

/** Explica en una frase por qué las propuestas son las que son. */
function describeContext(ctx: SuggestionContext): string {
  const parts: string[] = [];
  if (ctx.trained) parts.push('hoy has entrenado');
  if (ctx.hunger === 'veryLow') parts.push('tienes muy poco apetito, así que las opciones son pequeñas y densas');
  else if (ctx.hunger === 'low') parts.push('tienes poca hambre');
  else if (ctx.hunger === 'high') parts.push('tienes bastante hambre');
  if (ctx.digestion === 'bloated' || ctx.digestion === 'bad') {
    parts.push('te has notado hinchado, así que se evita lo más fermentable y la fibra alta');
  }
  if (ctx.availableFoodIds?.length) parts.push('solo se usan los alimentos que tienes en casa');
  if (!parts.length) return 'Se tiene en cuenta la hora, lo que te falta y lo que sueles comer.';
  return `Se tiene en cuenta que ${parts.join(', ')}.`;
}
