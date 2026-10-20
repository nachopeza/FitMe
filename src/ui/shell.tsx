import { createContext, useContext, useState, type ReactNode } from 'react';
import type { MealEntry, MealSlot } from '../domain/types';
import type { ParsedItem } from '../domain/parser';

/** Pestañas de la barra inferior. */
export type Tab = 'today' | 'workout' | 'add' | 'progress' | 'profile';

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
  | { k: 'basics' }
  | { k: 'calendar' }
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
  | { k: 'foodEdit'; id?: string; name?: string }
  | { k: 'macros' }
  | { k: 'targets' }
  | { k: 'history' }
  | { k: 'privacy' }
  | { k: 'ai' }
  | { k: 'composition'; id: string }
  | { k: 'workout' }
  | { k: 'routine'; id?: string }
  | { k: 'exercise'; id: string };

interface UIContextValue {
  tab: Tab;
  setTab: (t: Tab) => void;
  sheet: SheetSpec | null;
  open: (s: SheetSpec) => void;
  close: () => void;
  /** Sustituye la hoja actual sin apilar (p. ej. voz → confirmar). */
  replace: (s: SheetSpec) => void;
  toast: Toast | null;
  notify: (msg: string, undo?: () => void | Promise<void>) => void;
  dismissToast: () => void;
}

/**
 * Aviso flotante. `undo` existe para que registrar de un toque no dé miedo: si
 * se añade algo por error, se deshace desde el propio aviso.
 */
export interface Toast {
  message: string;
  undo?: () => void | Promise<void>;
}

const UIContext = createContext<UIContextValue | null>(null);

export function UIProvider({ children }: { children: ReactNode }) {
  const [tab, setTab] = useState<Tab>('today');
  const [sheet, setSheet] = useState<SheetSpec | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);

  const notify = (message: string, undo?: () => void | Promise<void>) => {
    const next: Toast = { message, undo };
    setToast(next);
    // Con opción de deshacer se deja más tiempo: hay que poder reaccionar.
    window.setTimeout(() => setToast((t) => (t === next ? null : t)), undo ? 5000 : 2600);
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
    dismissToast: () => setToast(null),
  };
  return <UIContext.Provider value={value}>{children}</UIContext.Provider>;
}

export function useUI(): UIContextValue {
  const ctx = useContext(UIContext);
  if (!ctx) throw new Error('useUI debe usarse dentro de UIProvider');
  return ctx;
}
