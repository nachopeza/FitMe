/**
 * Cliente mínimo de Supabase, con fetch.
 *
 * No se usa el SDK oficial a propósito: de él harían falta el alta, el inicio
 * de sesión, el refresco del token y un upsert. Eso son unas pocas llamadas
 * REST, y escribirlas aquí evita sumar 120 kB al paquete de una app que tiene
 * que arrancar sin conexión. A cambio, el refresco del token hay que hacerlo a
 * mano, que es lo que hace `withToken`.
 *
 * La API de Supabase son dos servicios sobre el mismo dominio:
 *   /auth/v1/…  → cuentas (GoTrue)
 *   /rest/v1/…  → datos (PostgREST), con las reglas por fila del propio
 *                 servidor decidiendo que cada quien solo ve lo suyo.
 */

export interface Credentials {
  url: string;
  anonKey: string;
}

export interface Session {
  accessToken: string;
  refreshToken: string;
  /** Milisegundos en los que caduca el token de acceso. */
  expiresAt: number;
  userId: string;
  email: string;
}

export class AccountError extends Error {
  constructor(message: string, readonly status?: number) {
    super(message);
    this.name = 'AccountError';
  }
}

/** Traduce los errores del servidor a algo que se pueda leer en pantalla. */
function describe(status: number, body: unknown): string {
  const msg = typeof body === 'object' && body
    ? String((body as Record<string, unknown>).msg
      ?? (body as Record<string, unknown>).error_description
      ?? (body as Record<string, unknown>).message
      ?? (body as Record<string, unknown>).error ?? '')
    : '';
  const lower = msg.toLowerCase();
  if (lower.includes('already registered') || lower.includes('already been registered')) {
    return 'Ya hay una cuenta con ese correo. Entra en vez de crearla.';
  }
  if (lower.includes('invalid login')) return 'Correo o contraseña incorrectos.';
  if (lower.includes('password should be')) return 'La contraseña necesita al menos 6 caracteres.';
  if (lower.includes('email') && lower.includes('invalid')) return 'Ese correo no parece válido.';
  if (status === 401 || status === 403) return 'La clave del proyecto no es válida o ha caducado.';
  if (status === 404) return 'La dirección del proyecto no responde. Revísala.';
  if (status >= 500) return 'El servidor no responde ahora mismo. Inténtalo luego.';
  return msg || `Error ${status}.`;
}

async function request(
  creds: Credentials,
  path: string,
  init: RequestInit & { token?: string } = {},
): Promise<{ body: unknown; headers: Headers }> {
  const { token, ...rest } = init;
  const res = await fetch(`${creds.url.replace(/\/+$/, '')}${path}`, {
    ...rest,
    headers: {
      apikey: creds.anonKey,
      Authorization: `Bearer ${token ?? creds.anonKey}`,
      'Content-Type': 'application/json',
      ...(rest.headers ?? {}),
    },
  });
  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }
  if (!res.ok) throw new AccountError(describe(res.status, body), res.status);
  return { body, headers: res.headers };
}

interface TokenResponse {
  access_token: string;
  refresh_token: string;
  expires_in: number;
  user?: { id: string; email: string };
}

function toSession(raw: unknown, fallbackEmail: string): Session {
  const t = raw as TokenResponse;
  if (!t?.access_token) {
    throw new AccountError('El servidor no ha devuelto una sesión. Revisa la configuración del proyecto.');
  }
  return {
    accessToken: t.access_token,
    refreshToken: t.refresh_token,
    expiresAt: Date.now() + (t.expires_in ?? 3600) * 1000,
    userId: t.user?.id ?? '',
    email: t.user?.email ?? fallbackEmail,
  };
}

/**
 * Alta.
 *
 * Si el proyecto exige confirmar el correo, Supabase responde sin sesión; eso
 * no es un error y hay que decirlo tal cual en vez de dejar la pantalla colgada.
 */
export async function signUp(
  creds: Credentials,
  email: string,
  password: string,
): Promise<Session | 'confirm-email'> {
  const { body } = await request(creds, '/auth/v1/signup', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  const t = body as TokenResponse;
  if (!t?.access_token) return 'confirm-email';
  return toSession(body, email);
}

export async function signIn(creds: Credentials, email: string, password: string): Promise<Session> {
  const { body } = await request(creds, '/auth/v1/token?grant_type=password', {
    method: 'POST',
    body: JSON.stringify({ email, password }),
  });
  return toSession(body, email);
}

export async function refresh(creds: Credentials, refreshToken: string): Promise<Session> {
  const { body } = await request(creds, '/auth/v1/token?grant_type=refresh_token', {
    method: 'POST',
    body: JSON.stringify({ refresh_token: refreshToken }),
  });
  return toSession(body, '');
}

/** Cierra la sesión en el servidor. Si falla, en local se cierra igualmente. */
export async function signOut(creds: Credentials, session: Session): Promise<void> {
  await request(creds, '/auth/v1/logout', { method: 'POST', token: session.accessToken })
    .catch(() => undefined);
}

/**
 * Ejecuta algo con un token válido, refrescándolo si está a punto de caducar.
 *
 * El margen de un minuto evita el caso tonto de empezar una sincronización con
 * un token que caduca a mitad.
 */
export async function withToken<T>(
  creds: Credentials,
  session: Session,
  fn: (token: string) => Promise<T>,
): Promise<{ result: T; session: Session }> {
  let current = session;
  if (current.expiresAt - Date.now() < 60_000) {
    current = { ...(await refresh(creds, current.refreshToken)), email: current.email || session.email };
  }
  return { result: await fn(current.accessToken), session: current };
}

/** Una fila de datos tal y como viaja. */
export interface RemoteRecord {
  kind: string;
  rec_id: string;
  data: unknown;
  updated_at: number;
  deleted: boolean;
}

/** Trae lo que haya cambiado desde `since`. */
export async function pull(
  creds: Credentials,
  token: string,
  since: number,
): Promise<RemoteRecord[]> {
  const { body } = await request(
    creds,
    `/rest/v1/records?select=kind,rec_id,data,updated_at,deleted&updated_at=gt.${since}&order=updated_at.asc`,
    { token },
  );
  return Array.isArray(body) ? (body as RemoteRecord[]) : [];
}

/** Sube un lote. El servidor resuelve el conflicto de clave con un upsert. */
export async function push(
  creds: Credentials,
  token: string,
  rows: RemoteRecord[],
): Promise<void> {
  if (!rows.length) return;
  await request(creds, '/rest/v1/records?on_conflict=user_id,kind,rec_id', {
    method: 'POST',
    token,
    headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
    body: JSON.stringify(rows),
  });
}

/**
 * La hora del servidor.
 *
 * Hace falta para no usar el reloj del móvil como marca de "hasta aquí ya lo
 * tengo": un móvil adelantado se saltaría cambios.
 */
export async function serverTime(creds: Credentials, token: string): Promise<number> {
  const { headers } = await request(creds, '/rest/v1/records?select=rec_id&limit=1', { token });
  const date = headers.get('date');
  const parsed = date ? Date.parse(date) : Number.NaN;
  return Number.isFinite(parsed) ? parsed : Date.now();
}
