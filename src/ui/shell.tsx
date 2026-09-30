import { createContext, useContext, useState, type ReactNode } from 'react';
import type { MealEntry, MealSlot } from '../domain/types';
import type { ParsedItem } from '../domain/parser';

/** Pestañas de la barra inferior. */
export type Tab = 'today' | 'add' | 'macros' | 'progress' | 'profile';

/**
 * Hojas modales de la app. Un único tipo discriminado en lugar de un router:
 * es una app de una sola pantalla con capas, y así cada capa recibe sus datos
 * con tipos comprobados.
 */
export type SheetSpec =
  | { k: 'addMenu' }
  | { k: 'manual'; slot?: MealSlot; prefill?: ParsedItem[]; sourceNote?: string; method?: MealEntry['method'] }
  | { k: 'voice' }
  | { k: 'photo' }
  | { k: 'barcode' }
  | { k: 'label' }
  | { k: 'saved' }
  | { k: 'suggest'; mode: 'normal' | 'quick' | 'noCook'; pantry?: boolean; title?: string }
  | { k: 'weight' }
  | { k: 'training' }
  | { k: 'dayState' }
  | { k: 'entry'; id: string }
  | { k: 'recipe'; id?: string }
  | { k: 'saveMeal'; from: MealEntry }
  | { k: 'compare' }
  | { k: 'calculator' }
  | { k: 'shopping' }
  | { k: 'food'; id: string }
  | { k: 'targets' }
  | { k: 'history' }
  | { k: 'privacy' }
  | { k: 'ai' };

interface UIContextValue {
  tab: Tab;
  setTab: (t: Tab) => void;
  sheet: SheetSpec | null;
  open: (s: SheetSpec) => void;
  close: () => void;
  /** Sustituye la hoja actual sin apilar (p. ej. voz → confirmar). */
  replace: (s: SheetSpec) => void;
  toast: string | null;
  notify: (msg: string) => void;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>('today');
  const [sheet, setSheet] = useState<SheetSpec | null>(null);
  const [toast, setToast] = useState<string | null>(null);

  const notify = (msg: string) => {
    setToast(msg);
    window.setTimeout(() => setToast((t) => (t === msg ? null : t)), 2600);
  };

  const value: UIContextValue = {
    tab,
    setTab,
    sheet,
    open: setSheet,
    close: () => setSheet(null),
    replace: setSheet,
    toast,
    notify,
  };
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI debe usarse dentro de UIProvider');
  return ctx;
}
