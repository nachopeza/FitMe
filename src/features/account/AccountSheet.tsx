import { useEffect, useState } from 'react';
import { Field, Sheet } from '../../ui/components';
import { useUI } from '../../ui/shell';
import { useApp } from '../store';
import { AccountError, signIn, signOut, signUp, type Credentials, type Session } from './api';
import { markEverythingPending, pendingCount, syncNow } from './sync';

/**
 * Tu cuenta.
 *
 * La app funciona entera sin cuenta: los datos viven en el móvil y ahí se
 * quedan. Una cuenta sirve para una cosa concreta —recuperarlos en otro móvil o
 * si reinstalas— y por eso no se pide al empezar ni se pone por delante de
 * nada. Mientras no haya un proyecto configurado, aquí solo se explica cómo
 * crearlo: una pantalla de alta que no fuera a ningún sitio sería un decorado.
 */
export function AccountSheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const ui = useUI();
  const s = app.settings;
  const creds: Credentials | null = s.syncUrl && s.syncKey
    ? { url: s.syncUrl, anonKey: s.syncKey }
    : null;
  const session = s.syncSession ?? null;

  const [url, setUrl] = useState(s.syncUrl ?? '');
  const [key, setKey] = useState(s.syncKey ?? '');
  const [email, setEmail] = useState(session?.email ?? '');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'in' | 'up'>('up');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(0);

  useEffect(() => { void pendingCount().then(setPending); }, [s.lastSyncAt]);

  const saveCreds = async () => {
    setError(null);
    const clean = url.trim().replace(/\/+$/, '');
    if (!/^https:\/\/.+/.test(clean)) {
      setError('La dirección tiene que empezar por https://');
      return;
    }
    if (key.trim().length < 20) {
      setError('Esa clave parece incompleta.');
      return;
    }
    await app.actions.setSettings({ syncUrl: clean, syncKey: key.trim() });
    setNotice('Proyecto guardado. Ya puedes crear tu cuenta.');
  };

  const run = async (fn: () => Promise<Session | 'confirm-email'>) => {
    if (!creds) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const out = await fn();
      if (out === 'confirm-email') {
        setNotice('Te hemos mandado un correo para confirmar la cuenta. Confírmalo y vuelve a entrar.');
        return;
      }
      // Lo que ya había en el móvil tiene que subir la primera vez.
      const marked = await markEverythingPending();
      await app.actions.setSettings({ syncSession: out });
      const result = await syncNow(creds, out);
      await app.actions.setSettings({ syncSession: result.session, lastSyncAt: result.at });
      setPassword('');
      ui.notify(`Cuenta lista · ${result.pushed} registros guardados`);
      setNotice(marked > 0
        ? `Se han subido tus ${marked} registros y a partir de ahora se guardan solos.`
        : 'Cuenta enlazada.');
    } catch (err) {
      setError(err instanceof AccountError ? err.message : 'No se ha podido conectar. ¿Tienes red?');
    } finally {
      setBusy(false);
      void pendingCount().then(setPending);
    }
  };

  const doSync = async () => {
    if (!creds || !session) return;
    setBusy(true);
    setError(null);
    try {
      const result = await syncNow(creds, session);
      await app.actions.setSettings({ syncSession: result.session, lastSyncAt: result.at });
      ui.notify(`Sincronizado · ${result.pushed} subidos, ${result.pulled} traídos`);
    } catch (err) {
      setError(err instanceof AccountError ? err.message : 'No se ha podido sincronizar.');
    } finally {
      setBusy(false);
      void pendingCount().then(setPending);
    }
  };

  const leave = async () => {
    if (creds && session) await signOut(creds, session);
    await app.actions.setSettings({ syncSession: undefined });
    setNotice('Sesión cerrada. Tus datos siguen en este móvil.');
  };

  // ── Sin proyecto configurado ──
  if (!creds) {
    return (
      <Sheet title="Tu cuenta" subtitle="Para no perder los datos al cambiar de móvil" onClose={onClose}>
        <p className="note">
          Ahora mismo <b>todo vive solo en este teléfono</b>. Funciona sin conexión y nadie más lo ve, pero
          si borras la app o cambias de móvil, se va con ella. Una cuenta guarda una copia y te la devuelve
          al entrar.
        </p>

        <div className="card">
          <div className="card-title"><span>Cómo se monta, una vez</span></div>
          <ol className="cues">
            <li>Entra en <b>supabase.com</b> y crea un proyecto gratis (no pide tarjeta).</li>
            <li>En <b>SQL Editor</b>, pega el bloque de abajo y dale a ejecutar. Crea la tabla y la regla
              que hace que cada cuenta solo vea lo suyo.</li>
            <li>En <b>Settings → API</b>, copia la <b>Project URL</b> y la clave <b>anon public</b>, y
              pégalas aquí.</li>
          </ol>
          <pre className="sql">{SQL}</pre>
          <button className="btn sm" onClick={() => void navigator.clipboard?.writeText(SQL)
            .then(() => ui.notify('SQL copiado.'))
            .catch(() => ui.notify('Cópialo a mano desde el recuadro.'))}>
            Copiar el SQL
          </button>
        </div>

        <Field label="Dirección del proyecto">
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)}
            aria-label="Dirección del proyecto" placeholder="https://xxxx.supabase.co" inputMode="url" />
        </Field>
        <Field label="Clave pública (anon)" hint="Está pensada para ir en la app. Quien decide qué ve cada cuenta es el servidor.">
          <input className="input" value={key} onChange={(e) => setKey(e.target.value)}
            aria-label="Clave pública" placeholder="eyJhbGciOi…" />
        </Field>

        {error && <div className="estimate" style={{ borderColor: 'var(--over)' }}>{error}</div>}
        {notice && <p className="note-strong">{notice}</p>}

        <button className="btn primary" style={{ marginTop: 12 }} onClick={() => void saveCreds()}>
          Guardar el proyecto
        </button>
      </Sheet>
    );
  }

  // ── Con sesión abierta ──
  if (session) {
    return (
      <Sheet title="Tu cuenta" subtitle={session.email} onClose={onClose}>
        <div className="guide-facts">
          <div className="fact">
            <span className="fact-label">Última sincronización</span>
            <span className="fact-value">
              {s.lastSyncAt ? new Date(s.lastSyncAt).toLocaleString('es-ES', { dateStyle: 'short', timeStyle: 'short' }) : 'nunca'}
            </span>
          </div>
          <div className="fact">
            <span className="fact-label">Cambios sin subir</span>
            <span className="fact-value">{pending}</span>
          </div>
        </div>

        {error && <div className="estimate" style={{ borderColor: 'var(--over)' }}>{error}</div>}
        {notice && <p className="note-strong">{notice}</p>}

        <button className="btn primary" disabled={busy} onClick={() => void doSync()}>
          {busy ? <span className="spinner" /> : 'Sincronizar ahora'}
        </button>
        <p className="note tight" style={{ marginTop: 10 }}>
          Se sincroniza sola al abrir la app y al volver a tener red. Esto es por si quieres asegurarte.
        </p>

        <button className="btn danger sm" style={{ marginTop: 16 }} onClick={() => void leave()}>
          Cerrar sesión en este móvil
        </button>
        <p className="note tight">
          Cerrar sesión no borra nada: los datos se quedan aquí y en tu cuenta.
        </p>
      </Sheet>
    );
  }

  // ── Proyecto listo, falta la cuenta ──
  return (
    <Sheet
      title={mode === 'up' ? 'Crear tu cuenta' : 'Entrar'}
      subtitle={s.syncUrl?.replace('https://', '')}
      onClose={onClose}
      footer={
        <button className="btn primary" disabled={busy || !email || password.length < 6}
          onClick={() => void run(() => (mode === 'up'
            ? signUp(creds, email.trim(), password)
            : signIn(creds, email.trim(), password)))}>
          {busy ? <span className="spinner" /> : mode === 'up' ? 'Crear cuenta' : 'Entrar'}
        </button>
      }
    >
      <Field label="Correo">
        <input className="input" type="email" inputMode="email" autoComplete="email"
          aria-label="Correo" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Contraseña" hint="Al menos 6 caracteres.">
        <input className="input" type="password"
          autoComplete={mode === 'up' ? 'new-password' : 'current-password'}
          aria-label="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
      </Field>

      {error && <div className="estimate" style={{ borderColor: 'var(--over)' }}>{error}</div>}
      {notice && <p className="note-strong">{notice}</p>}

      <button className="btn quiet sm" style={{ marginTop: 12 }}
        onClick={() => { setMode((m) => (m === 'up' ? 'in' : 'up')); setError(null); }}>
        {mode === 'up' ? 'Ya tengo cuenta' : 'Crear una cuenta nueva'}
      </button>

      <p className="note tight" style={{ marginTop: 14 }}>
        Al crearla se suben los datos que ya tienes en este móvil. A partir de ahí, cada cambio se guarda
        solo.
      </p>
    </Sheet>
  );
}

/** El esquema, en una sola pieza para copiar y pegar. */
const SQL = `create table if not exists public.records (
  user_id    uuid not null references auth.users on delete cascade,
  kind       text not null,
  rec_id     text not null,
  data       jsonb,
  updated_at bigint not null,
  deleted    boolean not null default false,
  primary key (user_id, kind, rec_id)
);

alter table public.records enable row level security;

create policy "solo lo mio" on public.records
  for all using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

alter table public.records
  alter column user_id set default auth.uid();

create index if not exists records_updated_at
  on public.records (user_id, updated_at);`;
