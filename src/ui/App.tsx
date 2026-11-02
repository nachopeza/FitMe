import { Suspense, lazy, useEffect, useMemo, useState, type ReactNode } from 'react';
import { useApp } from '../features/store';
import { ManualLog } from '../features/capture/ManualLog';
import { VoiceLog } from '../features/capture/VoiceLog';
import { CompositionSheet } from '../features/capture/CompositionSheet';
import { SuggestSheet } from '../features/suggest/SuggestSheet';
import { DayStateSheet, TrainingSheet, WeightSheet } from '../features/sheets/DaySheets';
import { AiSheet, EntrySheet, FoodSheet, HistorySheet, PrivacySheet, TargetsSheet } from '../features/sheets/MiscSheets';
import { SavedMealsSheet } from '../features/recipes/RecipeSheet';
import { COMPOSITIONS } from '../data/compositions';
import { nowTime } from '../domain/dates';
import { scaleNutrients } from '../domain/nutrition';
import { itemsNutrients } from '../features/logging';
import { iconForText, quickAddItems, slotFromHour } from '../features/quickAdd';
import { Sheet, g } from './components';
import { Onboarding } from './screens/Onboarding';
import { ProfileScreen } from './screens/ProfileScreen';
import { applyTheme, watchSystemTheme } from './theme';
import { TodayScreen } from './screens/Today';
import { WorkoutScreen } from './screens/Workout';
import { AccountSheet } from '../features/account/AccountSheet';
import { CalendarSheet } from '../features/sheets/CalendarSheet';
import { CopyDaySheet } from '../features/sheets/CopyDaySheet';
import { DataSheet } from '../features/sheets/DataSheet';
import { FoodEditSheet } from '../features/sheets/FoodEditSheet';
import { MyBasics } from '../features/sheets/MyBasics';
import { Icon, type IconName } from './icons';
import { useUI, type Tab } from './shell';
import { chunk } from './recovery';

/**
 * Carga diferida de lo que pesa y no se abre en cada sesión: las gráficas
 * (recharts), la cámara con el lector de códigos y las herramientas. La pantalla
 * de hoy, que es la que se abre siempre, no espera por nada de esto.
 */
const ProgressScreen = lazy(() => chunk(() => import('./screens/Progress').then((m) => ({ default: m.ProgressScreen }))));
const MacrosSheet = lazy(() => chunk(() => import('./screens/Macros').then((m) => ({ default: m.MacrosSheet }))));
const PhotoAnalyze = lazy(() => chunk(() => import('../features/capture/PhotoAnalyze').then((m) => ({ default: m.PhotoAnalyze }))));
const BarcodeScan = lazy(() => chunk(() => import('../features/capture/BarcodeScan').then((m) => ({ default: m.BarcodeScan }))));
const LabelScan = lazy(() => chunk(() => import('../features/capture/LabelScan').then((m) => ({ default: m.LabelScan }))));
const RecipeSheet = lazy(() => chunk(() => import('../features/recipes/RecipeSheet').then((m) => ({ default: m.RecipeSheet }))));
const CalculatorSheet = lazy(() => chunk(() => import('../features/tools/Tools').then((m) => ({ default: m.CalculatorSheet }))));
const CompareSheet = lazy(() => chunk(() => import('../features/tools/Tools').then((m) => ({ default: m.CompareSheet }))));
const ShoppingSheet = lazy(() => chunk(() => import('../features/tools/Tools').then((m) => ({ default: m.ShoppingSheet }))));
const RoutineSheet = lazy(() => chunk(() => import('../features/workout/RoutineSheet').then((m) => ({ default: m.RoutineSheet }))));
const PlanSheet = lazy(() => chunk(() => import('../features/plan/PlanSheet').then((m) => ({ default: m.PlanSheet }))));
const PlanMealSheet = lazy(() => chunk(() => import('../features/plan/PlanMealSheet').then((m) => ({ default: m.PlanMealSheet }))));
const ExerciseHistorySheet = lazy(() =>
  chunk(() => import('../features/workout/RoutineSheet').then((m) => ({ default: m.ExerciseHistorySheet }))),
);

function Loading({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="center-screen"><span className="spinner" /></div>}>
      {children}
    </Suspense>
  );
}

const NAV: { tab: Tab; label: string; icon: IconName }[] = [
  { tab: 'today', label: 'Hoy', icon: 'today' },
  { tab: 'workout', label: 'Entreno', icon: 'dumbbell' },
  { tab: 'add', label: '', icon: 'plus' },
  { tab: 'progress', label: 'Progreso', icon: 'progress' },
  { tab: 'profile', label: 'Perfil', icon: 'profile' },
];

export function App() {
  const app = useApp();
  const ui = useUI();

  useEffect(() => {
    // El script de index.html ya pintó el tema guardado antes del primer
    // pintado; esto lo reconcilia con IndexedDB, que es la fuente de verdad, y
    // con «Sistema» se queda escuchando el modo del móvil mientras esté abierta.
    applyTheme(app.settings.theme);
    return watchSystemTheme(app.settings.theme);
  }, [app.settings.theme]);

  if (app.phase === 'loading') {
    return (
      <div className="center-screen">
        <div>
          <span className="spinner" style={{ width: 24, height: 24 }} />
          <p className="note" style={{ marginTop: 14 }}>Abriendo tus datos…</p>
        </div>
      </div>
    );
  }

  if (app.phase === 'onboarding') {
    return <div className="app"><Onboarding /></div>;
  }

  // Con una hoja abierta el contenido de detrás queda inerte: el fondo ya lo
  // tapa, pero sin esto el tabulador se sigue colando por debajo del modal.
  const behind = ui.sheet ? ({ inert: '' } as Record<string, string>) : {};

  return (
    <div className="app">
      <TopBar />
      <div {...behind}>
        {ui.tab === 'today' && <TodayScreen />}
        {ui.tab === 'workout' && <WorkoutScreen />}
        {ui.tab === 'progress' && <Loading><ProgressScreen /></Loading>}
        {ui.tab === 'profile' && <ProfileScreen />}

        <nav className="nav" aria-label="Navegación principal" data-tab={ui.tab}>
          {/* La cápsula viaja hasta la pestaña activa en vez de encenderse de
              golpe: el movimiento es lo que hace que la barra se sienta viva. */}
          <span className="nav-pill" aria-hidden="true" />
          {NAV.map((item) =>
            item.tab === 'add' ? (
              <button key="add" className="nav-add" aria-label="Añadir" onClick={() => ui.open({ k: 'addMenu' })}>
                <Icon name="plus" size={24} />
              </button>
            ) : (
              <button
                key={item.tab}
                className="nav-btn"
                aria-current={ui.tab === item.tab ? 'page' : undefined}
                onClick={() => ui.setTab(item.tab)}
              >
                <span className="ico">
                  <Icon name={item.icon} size={22} active={ui.tab === item.tab} />
                </span>
                {item.label}
              </button>
            ),
          )}
        </nav>
      </div>

      <Loading><SheetRouter /></Loading>

      {ui.toast && (
        <div className="toast" role="status">
          <span>{ui.toast.message}</span>
          {ui.toast.undo && (
            <button
              className="link"
              style={{ color: 'var(--paper)', marginLeft: 12, textDecoration: 'underline' }}
              onClick={async () => {
                const undo = ui.toast?.undo;
                ui.dismissToast();
                await undo?.();
              }}
            >
              Deshacer
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/** Un solo sitio donde se decide qué capa se abre. */
function SheetRouter() {
  const ui = useUI();
  const s = ui.sheet;
  if (!s) return null;
  const close = ui.close;

  switch (s.k) {
    case 'addMenu': return <AddMenu />;
    case 'manual': return <ManualLog onClose={close} slot={s.slot} prefill={s.prefill} sourceNote={s.sourceNote} />;
    case 'voice': return <VoiceLog onClose={close} />;
    case 'composition': return <CompositionSheet id={s.id} onClose={close} />;
    case 'photo': return <PhotoAnalyze onClose={close} />;
    case 'basics': return <MyBasics onClose={close} />;
    case 'calendar': return <CalendarSheet onClose={close} />;
    case 'account': return <AccountSheet onClose={close} />;
    case 'barcode': return <BarcodeScan onClose={close} />;
    case 'label': return <LabelScan onClose={close} />;
    case 'saved': return <SavedMealsSheet onClose={close} />;
    case 'suggest': return <SuggestSheet onClose={close} mode={s.mode} pantry={s.pantry} title={s.title} />;
    case 'weight': return <WeightSheet onClose={close} />;
    case 'training': return <TrainingSheet onClose={close} />;
    case 'dayState': return <DayStateSheet onClose={close} />;
    case 'entry': return <EntrySheet id={s.id} onClose={close} />;
    case 'food': return <FoodSheet id={s.id} onClose={close} />;
    case 'foodEdit': return <FoodEditSheet id={s.id} name={s.name} onClose={close} />;
    case 'recipe': return <RecipeSheet id={s.id} onClose={close} />;
    case 'compare': return <CompareSheet onClose={close} />;
    case 'calculator': return <CalculatorSheet onClose={close} />;
    case 'shopping': return <ShoppingSheet onClose={close} />;
    case 'macros': return <MacrosSheet onClose={close} />;
    case 'targets': return <TargetsSheet onClose={close} />;
    case 'history': return <HistorySheet onClose={close} />;
    case 'privacy': return <PrivacySheet onClose={close} />;
    case 'ai': return <AiSheet onClose={close} />;
    case 'routine': return <RoutineSheet id={s.id} onClose={close} />;
    case 'exercise': return <ExerciseHistorySheet id={s.id} onClose={close} />;
    case 'plan': return <PlanSheet onClose={close} />;
    case 'planMeal': return <PlanMealSheet id={s.id} onClose={close} />;
    case 'copyDay': return <CopyDaySheet onClose={close} />;
    case 'data': return <DataSheet onClose={close} />;
    case 'workout': return <WorkoutRedirect />;
    default: return null;
  }
}

/** El entreno vive en su propia pestaña; desde otros sitios se redirige allí. */
function WorkoutRedirect() {
  const ui = useUI();
  useEffect(() => {
    ui.setTab('workout');
    ui.close();
  }, [ui]);
  return null;
}

/**
 * Barra superior de cristal.
 *
 * Aparece al desplazar, igual que en iOS: arriba del todo manda el título
 * grande de la pantalla y, en cuanto se va, su nombre queda fijo sobre un
 * cristal translúcido por el que se ve pasar el contenido.
 */
function TopBar() {
  const ui = useUI();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 28);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Al cambiar de pestaña se vuelve arriba: si no, la barra aparece encendida
  // sobre una pantalla que está en su principio.
  useEffect(() => {
    window.scrollTo({ top: 0 });
    setScrolled(false);
  }, [ui.tab]);

  const title = NAV.find((n) => n.tab === ui.tab)?.label ?? '';
  return (
    <div className={`topbar${scrolled ? ' is-visible' : ''}`} aria-hidden={!scrolled}>
      <span>{title}</span>
    </div>
  );
}

/** Menú de añadir: las vías de registro, de la más rápida a la más laboriosa. */
function AddMenu() {
  const ui = useUI();
  const app = useApp();

  // El reconocimiento de platos es la única vía que depende de una clave propia.
  // Se dice aquí, antes de hacer la foto, en vez de dejar que parezca averiado.
  const aiReady = app.settings.aiProvider === 'anthropic' && !!app.settings.aiApiKey;

  /** Sus básicos, resueltos a la ración por defecto de cada alimento. */
  const basicFoods = useMemo(
    () => (app.profile?.basicFoodIds ?? []).flatMap((id) => {
      const food = app.foodsById.get(id);
      if (!food) return [];
      const portion = food.portions.find((p) => p.isDefault) ?? food.portions[0];
      return [{
        id: food.id,
        name: food.name,
        icon: iconForText(food.name),
        portionLabel: portion?.label ?? '100 g',
        nutrients: scaleNutrients(food.per100g, portion?.grams ?? 100),
        useCount: 0,
      }];
    }),
    [app.profile?.basicFoodIds, app.foodsById],
  );

  const habituales = useMemo(
    () => quickAddItems({
      savedMeals: app.savedMeals,
      macrosOf: (meal) => itemsNutrients(meal.items),
      slot: slotFromHour(nowTime()),
      limit: 6,
      basics: basicFoods,
    }).filter((item) => item.kind !== 'composition'),
    [app.savedMeals, basicFoods],
  );

  const addHabitual = async (item: (typeof habituales)[number]) => {
    const id = item.kind === 'basic'
      ? await app.actions.logBasicFood(item.id)
      : await app.actions.logSavedMeal(item.id);
    if (id) {
      ui.close();
      ui.notify(`${item.name} · ${g(item.kcal)} kcal`, () => app.actions.deleteEntry(id));
    }
  };

  const tiles: { sheet: Parameters<typeof ui.replace>[0]; icon: IconName; label: string; sub: string }[] = [
    { sheet: { k: 'voice' }, icon: 'mic', label: 'Voz', sub: 'Dilo y ya' },
    { sheet: { k: 'saved' }, icon: 'star', label: 'Guardado', sub: 'Tus habituales' },
    { sheet: { k: 'basics' }, icon: 'bowl', label: 'Mis básicos', sub: 'Elegir los tuyos' },
    { sheet: { k: 'manual' }, icon: 'pen', label: 'Buscar', sub: 'Alimento a alimento' },
    { sheet: { k: 'photo' }, icon: 'camera', label: 'Foto', sub: aiReady ? 'Analizar un plato' : 'Sin activar' },
    { sheet: { k: 'barcode' }, icon: 'barcode', label: 'Código', sub: 'De un envase' },
    { sheet: { k: 'label' }, icon: 'tag', label: 'Etiqueta', sub: 'Tabla nutricional' },
    { sheet: { k: 'foodEdit' }, icon: 'pen', label: 'Producto nuevo', sub: 'Crearlo a mano' },
  ];

  return (
    <Sheet title="Añadir" onClose={ui.close}>
      {/* Sus habituales, de un toque.
          Esto estaba en un carrusel en HOY, y HOY ahora lo ocupa el plan. Pero
          lo que se registra a diario no puede costar más que antes, así que lo
          que él más usa abre este menú en vez de cerrarlo. */}
      {habituales.length > 0 && (
        <div className="field">
          <span className="field-label">Lo que más repites</span>
          <div className="quick">
            {habituales.map((item) => (
              <button className="quick-tile" key={item.key} onClick={() => void addHabitual(item)}>
                <span style={{ color: 'var(--accent)', display: 'grid' }}><Icon name={item.icon} size={19} /></span>
                <span className="quick-name">{item.name}</span>
                <span className="quick-macros">
                  {item.instant ? `${g(item.kcal)} kcal` : item.note ?? 'Elegir'}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Lo componible va después: es lo que más veces se registra. */}
      <div className="field">
        <span className="field-label">Montar al momento</span>
        <div className="quick">
          {COMPOSITIONS.map((c) => (
            <button className="quick-tile" key={c.id} onClick={() => ui.replace({ k: 'composition', id: c.id })}>
              <span style={{ color: 'var(--accent)', display: 'grid' }}><Icon name={c.icon} size={19} /></span>
              <span className="quick-name">{c.name}</span>
              <span className="quick-macros">{c.tagline}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">Otras formas</span>
        <div className="add-grid">
          {tiles.map((t) => (
            <button key={t.label} className="add-tile" onClick={() => ui.replace(t.sheet)}>
              <span className="ico"><Icon name={t.icon} size={21} /></span>
              <span>{t.label}</span>
              <span className="add-tile-sub">{t.sub}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="field">
        <span className="field-label">El día</span>
        <div className="btns">
          <button className="btn" onClick={() => { ui.close(); ui.setTab('workout'); }}>Entrenamiento</button>
          <button className="btn" onClick={() => ui.replace({ k: 'weight' })}>Peso</button>
        </div>
        <div className="btns" style={{ marginTop: 9 }}>
          <button className="btn" onClick={() => ui.replace({ k: 'dayState' })}>Hambre y pasos</button>
          <button className="btn" onClick={() => ui.replace({ k: 'suggest', mode: 'normal', pantry: true, title: 'Tengo esto en casa' })}>
            Tengo esto en casa
          </button>
        </div>
      </div>

    </Sheet>
  );
}
