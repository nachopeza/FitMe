/**
 * Decidir qué va para arriba y qué viene para abajo.
 *
 * Es la parte peligrosa de una sincronización: aquí es donde se pierden datos
 * si uno se equivoca. Por eso vive en el dominio, sin red ni base de datos, y
 * se prueba sola.
 *
 * REGLAS, explícitas a propósito:
 *
 * 1. Gana la escritura más reciente, comparando `updatedAt` de cada registro.
 *    No hay fusión campo a campo: una comida editada en dos sitios a la vez se
 *    queda con la última, no con una mezcla que no escribió nadie.
 * 2. Un borrado gana los empates. Si en el mismo milisegundo se borró en un
 *    sitio y se editó en otro, prevalece el borrado: es más fácil volver a
 *    añadir algo que darse cuenta de que algo que borraste ha resucitado.
 * 3. Lo que no está en el servidor se sube; lo que no está en local se baja.
 *    Incluidos los borrados, que viajan como lápidas para que el borrado se
 *    propague en vez de que el otro dispositivo lo reponga.
 * 4. Ante la duda, no se destruye: si falta `updatedAt` en un lado, ese lado se
 *    trata como más antiguo.
 */

export interface SyncStamp {
  /** Identificador del registro dentro de su tipo. */
  id: string;
  /** Milisegundos de la última escritura. */
  updatedAt: number;
  /** Lápida: el registro se borró. */
  deleted?: boolean;
}

export type SyncAction = 'push' | 'pull' | 'skip';

/** Qué hacer con un registro que existe en los dos lados. */
export function decide(local: SyncStamp | null, remote: SyncStamp | null): SyncAction {
  if (!local && !remote) return 'skip';
  if (!remote) return 'push';
  if (!local) return 'pull';

  const l = Number.isFinite(local.updatedAt) ? local.updatedAt : 0;
  const r = Number.isFinite(remote.updatedAt) ? remote.updatedAt : 0;

  if (l > r) return 'push';
  if (r > l) return 'pull';
  // Empate exacto: solo importa si uno de los dos es un borrado.
  if (local.deleted && !remote.deleted) return 'push';
  if (remote.deleted && !local.deleted) return 'pull';
  return 'skip';
}

export interface SyncPlan {
  push: string[];
  pull: string[];
}

/**
 * El plan completo para un tipo de registro.
 *
 * Devuelve ids, no datos: quien llama ya tiene los dos lados cargados y así
 * esta función no necesita saber nada de cómo se guardan.
 */
export function plan(locals: SyncStamp[], remotes: SyncStamp[]): SyncPlan {
  const byId = new Map<string, { local?: SyncStamp; remote?: SyncStamp }>();
  for (const l of locals) byId.set(l.id, { ...byId.get(l.id), local: l });
  for (const r of remotes) byId.set(r.id, { ...byId.get(r.id), remote: r });

  const push: string[] = [];
  const pull: string[] = [];
  for (const [id, pair] of byId) {
    const action = decide(pair.local ?? null, pair.remote ?? null);
    if (action === 'push') push.push(id);
    else if (action === 'pull') pull.push(id);
  }
  // Orden estable: facilita comparar y hace las pruebas legibles.
  push.sort();
  pull.sort();
  return { push, pull };
}

/**
 * Hasta qué momento se puede dar por traída la información.
 *
 * Se usa el reloj del SERVIDOR, no el del móvil: si el móvil va adelantado,
 * guardar su hora como marca haría que la próxima vez se saltara cambios que
 * llegaron entre medias. Se resta un margen por la misma razón.
 */
export function nextCursor(serverNow: number, marginMs = 2000): number {
  return Math.max(0, serverNow - marginMs);
}
