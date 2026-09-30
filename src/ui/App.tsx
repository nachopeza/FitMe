import { Suspense, lazy, useEffect, type ReactNode } from 'react';
import { useApp } from '../features/store';
import { ManualLog } from '../features/capture/ManualLog';
import { VoiceLog } from '../features/capture/VoiceLog';
import { SuggestSheet } from '../features/suggest/SuggestSheet';
import { DayStateSheet, TrainingSheet, WeightSheet } from '../features/sheets/DaySheets';
import {
  AiSheet, EntrySheet, FoodSheet, HistorySheet, PrivacySheet, TargetsSheet,
} from '../features/sheets/MiscSheets';
import { SavedMealsSheet } from '../features/recipes/RecipeSheet';
import { Sheet } from './components';
import { MacrosScreen } from './screens/Macros';
import { Onboarding } from './screens/Onboarding';
import { ProfileScreen, applyTheme } from './screens/ProfileScreen';
import { TodayScreen } from './screens/Today';
import { useUI, type Tab } from './shell';

/**
 * Carga diferida de lo que pesa y no se usa en cada sesión: las gráficas
 * (recharts), la cámara con el lector de códigos, y las herramientas. La
 * pantalla de HOY, que es la que se abre siempre, no espera por nada de esto.
 */
const ProgressScreen = lazy(() => import('./screens/Progress').then((m) => ({ default: m.ProgressScreen })));
const PhotoAnalyze = lazy(() => import('../features/capture/PhotoAnalyze').then((m) => ({ default: m.PhotoAnalyze })));
const BarcodeScan = lazy(() => import('../features/capture/BarcodeScan').then((m) => ({ default: m.BarcodeScan })));
const LabelScan = lazy(() => import('../features/capture/LabelScan').then((m) => ({ default: m.LabelScan })));
const RecipeSheet = lazy(() => import('../features/recipes/RecipeSheet').then((m) => ({ default: m.RecipeSheet })));
const CalculatorSheet = lazy(() => import('../features/tools/Tools').then((m) => ({ default: m.CalculatorSheet })));
const CompareSheet = lazy(() => import('../features/tools/Tools').then((m) => ({ default: m.CompareSheet })));
const ShoppingSheet = lazy(() => import('../features/tools/Tools').then((m) => ({ default: m.ShoppingSheet })));

function Loading({ children }: { children: ReactNode }) {
  return (
    <Suspense
      fallback={
        <div className="center-screen">
          <div className="spinner" style={{ width: 24, height: 24 }} />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}

const NAV: { tab: Tab; label: string; icon: string }[] = [
  { tab: 'today', label: 'HOY', icon: '📋' },
  { tab: 'macros', label: 'MACROS', icon: '📊' },
  { tab: 'add', label: '', icon: '+' },
  { tab: 'progress', label: 'PROGRESO', icon: '📈' },
  { tab: 'profile', label: 'PERFIL', icon: '👤' },
];

export function App() {
  const app = useApp();
  const ui = useUI();

  useEffect(() => {
    applyTheme(app.settings.theme);
  }, [app.settings.theme]);

  if (!app.ready) {
    return (
      <div className="center-screen">
        <div>
          <div className="spinner" style={{ width: 26, height: 26 }} />
          <p className="note" style={{ marginTop: 14 }}>Abriendo tu base de datos local…</p>
        </div>
      </div>
    );
  }

  if (app.needsOnboarding) {
    return <div className="app"><Onboarding /></div>;
  }

  // Con una hoja abierta, el contenido de detrás queda inerte: no recibe clics
  // ni foco de teclado. El fondo oscuro ya lo tapa visualmente, pero sin esto
  // el tabulador se sigue metiendo por debajo del modal.
  const behind = ui.sheet ? ({ inert: '' } as Record<string, string>) : {};

  return (
    <div className="app">
      <div {...behind}>
        {ui.tab === 'today' && <TodayScreen />}
        {ui.tab === 'macros' && <MacrosScreen />}
        {ui.tab === 'progress' && <Loading><ProgressScreen /></Loading>}
        {ui.tab === 'profile' && <ProfileScreen />}

        <nav className="nav" aria-label="Navegación principal">
          {NAV.map((item) =>
            item.tab === 'add' ? (
              <button key="add" className="nav-add" aria-label="Añadir comida" onClick={() => ui.open({ k: 'addMenu' })}>
                +
              </button>
            ) : (
              <button
                key={item.tab}
                className="nav-btn"
                aria-current={ui.tab === item.tab ? 'page' : undefined}
                onClick={() => ui.setTab(item.tab)}
              >
                <span className="ico" aria-hidden="true">{item.icon}</span>
                {item.label}
              </button>
            ),
          )}
        </nav>
      </div>

      <Loading><SheetRouter /></Loading>

      {ui.toast && (
        <div
          role="status"
          style={{
            position: 'fixed', left: 16, right: 16, bottom: 'calc(var(--nav-h) + 20px)',
            maxWidth: 520, margin: '0 auto', background: 'var(--bg-elev-2)',
            border: '1px solid var(--line-strong)', borderRadius: 'var(--r-sm)',
            padding: '11px 14px', fontSize: '0.85rem', zIndex: 60, textAlign: 'center',
            boxShadow: '0 8px 24px rgba(0,0,0,0.4)',
          }}
        >
          {ui.toast}
        </div>
      )}
    </div>
  );
}

/** Enrutado de las hojas modales. Un solo sitio donde se decide qué se abre. */
function SheetRouter() {
  const ui = useUI();
  const s = ui.sheet;
  if (!s) return null;
  const close = ui.close;

  switch (s.k) {
    case 'addMenu':
      return <AddMenu />;
    case 'manual':
      return <ManualLog onClose={close} slot={s.slot} prefill={s.prefill} sourceNote={s.sourceNote} />;
    case 'voice':
      return <VoiceLog onClose={close} />;
    case 'photo':
      return <PhotoAnalyze onClose={close} />;
    case 'barcode':
      return <BarcodeScan onClose={close} />;
    case 'label':
      return <LabelScan onClose={close} />;
    case 'saved':
      return <SavedMealsSheet onClose={close} />;
    case 'suggest':
      return <SuggestSheet onClose={close} mode={s.mode} pantry={s.pantry} title={s.title} />;
    case 'weight':
      return <WeightSheet onClose={close} />;
    case 'training':
      return <TrainingSheet onClose={close} />;
    case 'dayState':
      return <DayStateSheet onClose={close} />;
    case 'entry':
      return <EntrySheet id={s.id} onClose={close} />;
    case 'food':
      return <FoodSheet id={s.id} onClose={close} />;
    case 'recipe':
      return <RecipeSheet id={s.id} onClose={close} />;
    case 'compare':
      return <CompareSheet onClose={close} />;
    case 'calculator':
      return <CalculatorSheet onClose={close} />;
    case 'shopping':
      return <ShoppingSheet onClose={close} />;
    case 'targets':
      return <TargetsSheet onClose={close} />;
    case 'history':
      return <HistorySheet onClose={close} />;
    case 'privacy':
      return <PrivacySheet onClose={close} />;
    case 'ai':
      return <AiSheet onClose={close} />;
    default:
      return null;
  }
}

/** Menú del botón +: las cinco vías de registro. */
function AddMenu() {
  const ui = useUI();
  const app = useApp();
  const tiles: { k: Parameters<typeof ui.replace>[0]; icon: string; label: string; sub: string }[] = [
    { k: { k: 'voice' }, icon: '🎤', label: 'Voz', sub: 'Dilo y ya' },
    { k: { k: 'photo' }, icon: '📷', label: 'Foto', sub: 'Analiza el plato' },
    { k: { k: 'manual' }, icon: '✍️', label: 'Manual', sub: 'Buscar y añadir' },
    { k: { k: 'barcode' }, icon: '📦', label: 'Escanear', sub: 'Código de barras' },
    { k: { k: 'label' }, icon: '🏷️', label: 'Etiqueta', sub: 'Tabla nutricional' },
    { k: { k: 'saved' }, icon: '⭐', label: 'Guardado', sub: 'Tus habituales' },
  ];

  return (
    <Sheet title="Añadir comida" onClose={ui.close}>
      <div className="add-grid">
        {tiles.map((t) => (
          <button key={t.label} className="add-tile" onClick={() => ui.replace(t.k)}>
            <span className="ico" aria-hidden="true">{t.icon}</span>
            <span>{t.label}</span>
            <span style={{ fontSize: '0.64rem', color: 'var(--text-faint)', fontWeight: 500 }}>{t.sub}</span>
          </button>
        ))}
      </div>

      <div className="divider" />

      <div className="btn-row">
        <button className="btn" onClick={() => ui.replace({ k: 'training' })}>🏋️ Entrenamiento</button>
        <button className="btn" onClick={() => ui.replace({ k: 'weight' })}>⚖️ Peso</button>
      </div>
      <div className="btn-row">
        <button className="btn" onClick={() => ui.replace({ k: 'dayState' })}>😋 Hambre y pasos</button>
        <button className="btn" onClick={() => ui.replace({ k: 'recipe' })}>📖 Recetas</button>
      </div>
      <div className="btn-row one">
        <button className="btn" onClick={() => ui.replace({ k: 'suggest', mode: 'normal', pantry: true, title: '🏠 Tengo esto en casa' })}>
          🏠 Tengo esto en casa
        </button>
      </div>

      {app.savedMeals.length > 0 && (
        <>
          <div className="card-title" style={{ marginTop: 14 }}><span>Repetir rápido</span></div>
          <div className="chips">
            {[...app.savedMeals]
              .sort((a, b) => b.useCount - a.useCount)
              .slice(0, 6)
              .map((m) => (
                <button key={m.id} className="chip" onClick={() => ui.replace({ k: 'saved' })}>{m.name}</button>
              ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
