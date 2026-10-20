import { SYNCED, db, type OutboxRow, type SyncedKind } from '../../data/db';
import { plan, nextCursor, type SyncStamp } from '../../domain/sync';
import { pull, push, serverTime, withToken, type Credentials, type RemoteRecord, type Session } from './api';

/**
 * Llevar y traer.
 *
 * El dispositivo manda: aquí nunca se borra nada de local que no venga con una
 * lápida explícita del servidor, y ante cualquier fallo se corta y se deja todo
 * como estaba, porque media sincronización es peor que ninguna.
 */

/**
 * Del catálogo solo viaja lo suyo.
 *
 * Los 190 alimentos y los 96 ejercicios que trae la app son idénticos en todos
 * los dispositivos: subirlos sería mandar cientos de filas de algo que la app
 * ya incluye. Sí viajan los que él ha creado o corregido, porque esos son datos
 * suyos y se perderían.
 */
function worthSyncing(kind: SyncedKind, data: unknown): boolean {
  if (kind !== 'foods' && kind !== 'exercises') return true;
  const row = data as { custom?: boolean; edited?: boolean } | undefined;
  return !!(row?.custom || row?.edited);
}

/** La clave primaria de cada tabla: no todas se llaman `id`. */
const PRIMARY: Record<SyncedKind, string> = {
  profile: 'id', settings: 'id', entries: 'id', days: 'date', weights: 'id',
  workouts: 'id', routines: 'id', savedMeals: 'id', recipes: 'id', foods: 'id', exercises: 'id',
};

export interface SyncResult {
  pushed: number;
  pulled: number;
  at: number;
  session: Session;
}

const CURSOR_KEY = 'syncCursor';

async function getCursor(): Promise<number> {
  const row = await db.meta.get(CURSOR_KEY);
  return typeof row?.value === 'number' ? row.value : 0;
}

/**
 * Una pasada completa.
 *
 * Primero se baja —así un conflicto lo resuelve el plan con la versión remota
 * ya en la mano— y después se sube lo que siga siendo más nuevo aquí.
 */
export async function syncNow(creds: Credentials, session: Session): Promise<SyncResult> {
  const since = await getCursor();

  const { result, session: fresh } = await withToken(creds, session, async (token) => {
    const remotes = await pull(creds, token, since);
    const now = await serverTime(creds, token);

    // ── Bajar ──
    const byKind = new Map<SyncedKind, RemoteRecord[]>();
    for (const r of remotes) {
      if (!(SYNCED as readonly string[]).includes(r.kind)) continue;
      const kind = r.kind as SyncedKind;
      byKind.set(kind, [...(byKind.get(kind) ?? []), r]);
    }

    let pulled = 0;
    const outbox = await db.outbox.toArray();
    const localStamp = new Map(outbox.map((o) => [`${o.kind}:${o.id}`, o] as const));

    for (const [kind, rows] of byKind) {
      const table = db.table(kind);
      for (const row of rows) {
        const local = localStamp.get(`${kind}:${row.rec_id}`);
        // Si lo de aquí es más nuevo, no se pisa: ya se subirá abajo.
        if (local && local.updatedAt > row.updated_at) continue;
        if (row.deleted) {
          await table.delete(row.rec_id);
        } else if (row.data && typeof row.data === 'object') {
          await table.put({ ...(row.data as object), [PRIMARY[kind]]: row.rec_id });
        }
        // Lo que viene del servidor no vuelve a subirse.
        await db.outbox.delete(`${kind}:${row.rec_id}`);
        pulled++;
      }
    }

    // ── Subir ──
    const pending = await db.outbox.toArray();
    const payload: RemoteRecord[] = [];
    for (const o of pending) {
      if (o.deleted) {
        payload.push({ kind: o.kind, rec_id: o.id, data: null, updated_at: o.updatedAt, deleted: true });
        continue;
      }
      const data = await db.table(o.kind).get(o.id);
      if (data === undefined) {
        // Se anotó un cambio y el registro ya no está: viaja como borrado.
        payload.push({ kind: o.kind, rec_id: o.id, data: null, updated_at: o.updatedAt, deleted: true });
        continue;
      }
      if (!worthSyncing(o.kind, data)) continue;
      payload.push({ kind: o.kind, rec_id: o.id, data, updated_at: o.updatedAt, deleted: false });
    }

    // En lotes: un envío único con cientos de entrenos se queda sin tiempo.
    const BATCH = 200;
    for (let i = 0; i < payload.length; i += BATCH) {
      await push(creds, token, payload.slice(i, i + BATCH));
    }
    // Solo se vacía la bandeja cuando TODO se ha subido.
    await db.outbox.bulkDelete(pending.map((o) => o.key));

    return { pushed: payload.length, pulled, now };
  });

  await db.meta.put({ key: CURSOR_KEY, value: nextCursor(result.now) });
  return { pushed: result.pushed, pulled: result.pulled, at: Date.now(), session: fresh };
}

/**
 * Anota todo lo que hay en local como pendiente de subir.
 *
 * Se usa la primera vez que se enlaza una cuenta: sin esto, los datos que ya
 * existían en el móvil no tendrían ninguna anotación y no subirían nunca.
 */
export async function markEverythingPending(): Promise<number> {
  const rows: OutboxRow[] = [];
  const at = Date.now();
  for (const kind of SYNCED) {
    const all = await db.table(kind).toArray();
    for (const item of all) {
      if (!worthSyncing(kind, item)) continue;
      const id = String((item as Record<string, unknown>)[PRIMARY[kind]]);
      rows.push({ key: `${kind}:${id}`, kind, id, updatedAt: at });
    }
  }
  await db.outbox.bulkPut(rows);
  return rows.length;
}

/** Cuántos cambios esperan a subir. */
export async function pendingCount(): Promise<number> {
  return db.outbox.count();
}

/** Las marcas locales, por si hiciera falta inspeccionarlas. */
export async function localStamps(kind: SyncedKind): Promise<SyncStamp[]> {
  const rows = await db.outbox.where('kind').equals(kind).toArray();
  return rows.map((r) => ({ id: r.id, updatedAt: r.updatedAt, deleted: r.deleted }));
}

export { plan };
