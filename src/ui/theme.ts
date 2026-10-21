// El tema de la app, resuelto antes de pintar.
//
// El problema que esto arregla: el tema se aplicaba en un efecto de React, que
// corre después del primer pintado. En un móvil en modo oscuro la app arrancaba
// oscura (la media query de CSS) y saltaba a clara un instante después. Y el
// meta theme-color seguía al móvil, así que la barra de estado del iPhone se
// quedaba oscura encima de una app clara.
//
// Ahora el atributo data-theme SIEMPRE está puesto, resuelto por el script de
// index.html antes de la primera pintura. Eso permitió borrar la media query
// del CSS: la app no mira el modo del móvil salvo que elijas «Sistema», y
// entonces lo mira aquí, en JS, donde también puedo actualizar el cromo.

export type ThemeChoice = 'dark' | 'light' | 'system';

/** Donde se guarda la elección para poder leerla síncronamente antes de pintar.
 *  IndexedDB es la fuente de verdad, pero es asíncrona: no sirve para esto. */
export const THEME_KEY = 'fitme.theme';

/** El color del papel en cada tema. Pinta la barra de estado del iPhone, así
 *  que tiene que ser exactamente --paper o se ve una franja ajena arriba. */
const CHROME: Record<'light' | 'dark', string> = {
  light: '#f7f8fb',
  dark: '#0f141c',
};

export function prefersDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches;
}

export function resolveTheme(choice: ThemeChoice, systemIsDark: boolean): 'light' | 'dark' {
  if (choice === 'system') return systemIsDark ? 'dark' : 'light';
  return choice;
}

export function applyTheme(choice: ThemeChoice): void {
  const resolved = resolveTheme(choice, prefersDark());
  document.documentElement.setAttribute('data-theme', resolved);

  // El cromo del navegador sigue a la app, no al móvil.
  let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]');
  if (!meta) {
    meta = document.createElement('meta');
    meta.name = 'theme-color';
    document.head.appendChild(meta);
  }
  meta.content = CHROME[resolved];

  try {
    localStorage.setItem(THEME_KEY, choice);
  } catch {
    // Modo privado o almacenamiento lleno: se pierde el arranque sin parpadeo,
    // no la app. El efecto de React lo vuelve a aplicar.
  }
}

/** Con «Sistema» hay que seguir al móvil mientras la app está abierta, no solo
 *  al arrancar. Devuelve la función para dejar de escuchar. */
export function watchSystemTheme(choice: ThemeChoice): () => void {
  if (choice !== 'system' || typeof matchMedia !== 'function') return () => {};
  const mq = matchMedia('(prefers-color-scheme: dark)');
  const onChange = () => applyTheme('system');
  mq.addEventListener('change', onChange);
  return () => mq.removeEventListener('change', onChange);
}
