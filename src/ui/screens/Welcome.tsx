import { useState } from 'react';
import { AccountError, inspectKey, signIn } from '../../features/account/api';
import { markEverythingPending, syncNow } from '../../features/account/sync';
import { SUPABASE } from '../../config';
import { useApp } from '../../features/store';
import { Field } from '../components';
import { Icon } from '../icons';

/**
 * Lo primero al abrir en un móvil nuevo: correo y contraseña.
 *
 * Antes la app arrancaba preguntando peso, altura y edad aunque ya tuviera una
 * cuenta con todo eso dentro: había que montar el perfil a mano, entrar después
 * desde el perfil y ver cómo la sincronización lo sobrescribía. Para alguien
 * que reinstala, el onboarding no es la primera pantalla: es la segunda, y solo
 * si viene de cero.
 *
 * Entrar no es solo autenticarse: trae los datos ANTES de seguir, para que la
 * app no decida que no hay perfil mientras el suyo está de camino.
 */
export function Welcome({ onFresh }: { onFresh: () => void }) {
  const app = useApp();
  const [mode, setMode] = useState<'choose' | 'in' | 'project'>('choose');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  // La dirección viene puesta de fábrica: lo único que falta por pegar es la
  // clave, y un campo menos es un sitio menos donde equivocarse.
  const [url, setUrl] = useState<string>(SUPABASE.url);
  const [key, setKey] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [step, setStep] = useState<string | null>(null);

  const creds = app.syncCreds;

  const entrar = async () => {
    if (!creds) return;
    setBusy(true);
    setError(null);
    try {
      setStep('Comprobando la cuenta…');
      const out = await signIn(creds, email.trim(), password);
      // Lo que hubiera suelto en este móvil también sube, para no perderlo.
      await markEverythingPending();
      await app.actions.setSettings({
        syncSession: out,
        ...(app.settings.syncUrl ? {} : { syncUrl: creds.url, syncKey: creds.anonKey }),
      });
      setStep('Trayendo tus datos…');
      const result = await syncNow(creds, out);
      await app.actions.setSettings({ syncSession: result.session, lastSyncAt: result.at });
      // No se navega a ninguna parte: en cuanto el perfil aparezca en la base,
      // la app entra sola. Si no venía ninguno, cae al onboarding.
      setStep(`Listo · ${result.pulled} registros`);
    } catch (e) {
      setError(e instanceof AccountError ? e.message : 'No se ha podido entrar.');
    } finally {
      setBusy(false);
    }
  };

  const guardarProyecto = async () => {
    const limpia = url.trim().replace(/\/+$/, '');
    if (!/^https:\/\/.+/.test(limpia)) {
      setError('La dirección tiene que empezar por https://');
      return;
    }
    const revision = inspectKey(key);
    if (!revision.ok) {
      setError(revision.reason);
      return;
    }
    await app.actions.setSettings({ syncUrl: limpia, syncKey: key.trim() });
    setError(null);
    setMode('in');
  };

  // ── Pegar el proyecto, solo si esta instalación no lo trae ──
  if (mode === 'project') {
    return (
      <Shell title="Tu proyecto" sub="Solo esta vez, en este móvil">
        <p className="note">
          Esta copia de la app no trae el proyecto dentro, así que hace falta la dirección y la clave
          pública una vez. Están en Supabase, en los ajustes de la API de tu proyecto.
        </p>
        <Field label="Dirección del proyecto">
          <input className="input" value={url} onChange={(e) => setUrl(e.target.value)}
            aria-label="Dirección del proyecto" placeholder="https://xxxx.supabase.co" inputMode="url" />
        </Field>
        <Field label="Clave pública">
          <input className="input" value={key} onChange={(e) => setKey(e.target.value)}
            aria-label="Clave pública" placeholder="eyJhbGciOi… o sb_publishable_…" />
        </Field>
        {error && <div className="estimate" style={{ borderColor: 'var(--over)' }}>{error}</div>}
        <button className="btn primary" style={{ marginTop: 12 }} onClick={() => void guardarProyecto()}>
          Continuar
        </button>
        <button className="btn quiet sm" style={{ marginTop: 10 }} onClick={() => { setMode('choose'); setError(null); }}>
          Volver
        </button>
      </Shell>
    );
  }

  // ── Correo y contraseña ──
  if (mode === 'in') {
    return (
      <Shell title="Entra con tu cuenta" sub="Y traemos todo lo que tengas guardado">
        <Field label="Correo">
          <input className="input" type="email" inputMode="email" autoComplete="email"
            aria-label="Correo" value={email} onChange={(e) => setEmail(e.target.value)} autoFocus />
        </Field>
        <Field label="Contraseña">
          <input className="input" type="password" autoComplete="current-password"
            aria-label="Contraseña" value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>

        {error && <div className="estimate" style={{ borderColor: 'var(--over)' }}>{error}</div>}
        {step && !error && <p className="note-strong">{step}</p>}

        <button className="btn primary" style={{ marginTop: 12 }}
          disabled={busy || !email || password.length < 6} onClick={() => void entrar()}>
          {busy ? <span className="spinner" /> : 'Entrar y cargar mis datos'}
        </button>
        <button className="btn quiet sm" style={{ marginTop: 10 }} disabled={busy}
          onClick={() => { setMode('choose'); setError(null); setStep(null); }}>
          Volver
        </button>
      </Shell>
    );
  }

  // ── La elección ──
  return (
    <Shell title="FitMe" sub="Come lo que necesitas para crecer">
      <button className="go-row" style={{ marginBottom: 10 }}
        onClick={() => setMode(creds ? 'in' : 'project')}>
        <span className="go-play"><Icon name="profile" size={18} /></span>
        <span className="go-body">
          <span className="go-title">Ya tengo cuenta</span>
          <span className="go-meta">Entra y recupera tus datos</span>
        </span>
        <Icon name="chevron" size={18} />
      </button>

      <button className="go-row" onClick={onFresh}>
        <span className="go-play"><Icon name="plus" size={18} /></span>
        <span className="go-body">
          <span className="go-title">Empezar de cero</span>
          <span className="go-meta">Cuatro preguntas y a registrar</span>
        </span>
        <Icon name="chevron" size={18} />
      </button>

      <p className="note tight" style={{ marginTop: 16 }}>
        Si ya usabas FitMe en otro móvil, entra con tu cuenta: así vuelven tu perfil, tus pesadas y tu
        histórico. Empezar de cero no borra nada de la cuenta, pero este móvil arrancará vacío.
      </p>
    </Shell>
  );
}

/** El marco de las tres pantallas, para que no se repita. */
function Shell({ title, sub, children }: { title: string; sub: string; children: React.ReactNode }) {
  return (
    <div className="screen welcome">
      <header className="top">
        <div style={{ minWidth: 0 }}>
          <h1 className="screen-title">{title}</h1>
          <p className="screen-sub">{sub}</p>
        </div>
      </header>
      <div className="panel">{children}</div>
    </div>
  );
}
