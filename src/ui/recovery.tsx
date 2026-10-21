// Que un despliegue no deje la app en blanco.
//
// El fallo, reproducido: tenía la app abierta con la versión anterior y yo
// publiqué una nueva. Los trozos de JavaScript que se cargan aparte (Progreso,
// la cámara, las herramientas) llevan un hash en el nombre que cambia en cada
// publicación, así que los de su versión dejaron de existir en el servidor. Al
// tocar Progreso, el navegador pidió un archivo que ya no estaba, la promesa
// falló, nadie la recogía y React desmontó el árbol entero: pantalla en blanco.
//
// Tres capas, de la que previene a la que rescata:
//   1. Cuando el service worker nuevo toma el mando, recargar. Así nunca
//      convive una página vieja con un servidor nuevo.
//   2. Si un trozo falla de todas formas (una pestaña olvidada días), recargar
//      una vez: el index.html nuevo trae los nombres nuevos.
//   3. Y si aun así algo revienta, una pantalla con un botón, no un vacío.

import { Component, type ErrorInfo, type ReactNode } from 'react';

const MARCA = 'fitme.recargado-por-trozo';

function marca(): string | null {
  try { return sessionStorage.getItem(MARCA); } catch { return '1'; }
}

function marcar(v: string | null): void {
  try {
    if (v == null) sessionStorage.removeItem(MARCA);
    else sessionStorage.setItem(MARCA, v);
  } catch { /* sin sessionStorage no se puede recordar; se asume ya intentado */ }
}

/**
 * Envuelve un import() diferido para que un trozo caducado no sea un vacío.
 *
 * El límite de una recarga por intento es lo que evita el bucle, y aquí me
 * equivoqué una vez: si la marca se borrase en cada arranque, un trozo que
 * falta de verdad daría 404 → recarga → arranque → 404 → recarga, sin fin. La
 * marca solo se borra cuando un trozo se carga BIEN, que es la señal de que la
 * app está sana y de que un fallo posterior merece su propio intento.
 */
export function chunk<T>(load: () => Promise<T>): Promise<T> {
  return load().then(
    (mod) => {
      marcar(null);
      return mod;
    },
    (err: unknown) => {
      if (marca() !== '1') {
        marcar('1');
        location.reload();
      }
      throw err;
    },
  );
}

/**
 * Recargar cuando el service worker nuevo se hace cargo de esta página.
 *
 * El `controller` solo es null en la primerísima visita, antes de que haya
 * service worker; ahí el cambio de controlador es la instalación, no una
 * actualización, y recargar sería gratuito y molesto.
 */
export function recargarAlActualizar(): void {
  const sw = navigator.serviceWorker;
  if (!sw) return;
  if (!sw.controller) return;
  let recargando = false;
  sw.addEventListener('controllerchange', () => {
    if (recargando) return;
    recargando = true;
    location.reload();
  });
}

type Props = { children: ReactNode };
type State = { error: Error | null };

/**
 * El último recurso. No intenta arreglar nada: dice qué pasó y deja salir.
 * «Vaciar y recargar» borra las cachés del service worker y lo da de baja, que
 * es lo que desatasca una versión a medio actualizar. NO toca IndexedDB: ahí
 * están sus comidas, sus pesadas y sus entrenos.
 */
export class Rescate extends Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error): State {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('La app se cayó:', error, info.componentStack);
  }

  private vaciar = async () => {
    try {
      if ('caches' in window) {
        const nombres = await caches.keys();
        await Promise.all(nombres.map((n) => caches.delete(n)));
      }
      const regs = (await navigator.serviceWorker?.getRegistrations()) ?? [];
      await Promise.all(regs.map((r) => r.unregister()));
    } catch (e) {
      console.error('No se pudo vaciar la caché:', e);
    }
    location.reload();
  };

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <div className="center-screen">
        <div style={{ maxWidth: 320, textAlign: 'left' }}>
          <h2 style={{ marginTop: 0 }}>La app no ha podido abrirse</h2>
          <p className="note">
            Casi siempre es una versión a medio actualizar. Tus datos están a salvo: viven en el
            teléfono y esto no los toca.
          </p>
          <div className="btns" style={{ marginTop: 14 }}>
            <button className="btn primary" onClick={() => location.reload()}>Recargar</button>
            <button className="btn" onClick={() => void this.vaciar()}>Vaciar la caché y recargar</button>
          </div>
          {/* El mensaje técnico en pequeño: no le dice nada a él, pero si me
              manda una foto de esta pantalla me dice a mí qué falló. */}
          <p className="note tight" style={{ marginTop: 16, opacity: 0.6, fontSize: 12 }}>
            {this.state.error.message}
          </p>
        </div>
      </div>
    );
  }
}
