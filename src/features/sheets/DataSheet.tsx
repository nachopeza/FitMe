import { useEffect, useState } from 'react';
import { exportAll, importAll, type ExportBundle } from '../../data/db';
import { Sheet } from '../../ui/components';
import { Icon } from '../../ui/icons';
import { useUI } from '../../ui/shell';

/**
 * Dónde viven sus datos y cómo no perderlos.
 *
 * Esto existe porque se le perdieron. La app guarda todo en el almacén del
 * navegador, y ese almacén tiene dos trampas que nadie se espera:
 *
 *   - En iOS, el icono de la pantalla de inicio y Safari pueden NO compartir
 *     almacén. Registras en uno y en el otro no hay nada, sin aviso.
 *   - Safari borra el almacén de un sitio tras unos días sin visitarlo, salvo
 *     que esté marcado como persistente o instalado en la pantalla de inicio.
 *
 * Así que esta hoja dice las dos cosas en claro, enseña si el navegador ha
 * concedido la persistencia, y pone la copia de seguridad a un toque. Mientras
 * no haya cuenta, un archivo guardado es la única red de verdad.
 */
export function DataSheet({ onClose }: { onClose: () => void }) {
  const ui = useUI();
  const [busy, setBusy] = useState(false);
  const [estado, setEstado] = useState<{
    persistente: boolean | null;
    usado?: number;
    instalada: boolean;
  }>({ persistente: null, instalada: false });

  useEffect(() => {
    (async () => {
      let persistente: boolean | null = null;
      let usado: number | undefined;
      try {
        persistente = (await navigator.storage?.persisted?.()) ?? null;
        const est = await navigator.storage?.estimate?.();
        usado = est?.usage;
      } catch {
        persistente = null;
      }
      const instalada = window.matchMedia('(display-mode: standalone)').matches
        || (navigator as { standalone?: boolean }).standalone === true;
      setEstado({ persistente, usado, instalada });
    })();
  }, []);

  const pedirPersistencia = async () => {
    try {
      const ok = await navigator.storage?.persist?.();
      setEstado((e) => ({ ...e, persistente: ok ?? null }));
      ui.notify(ok ? 'Concedido: el navegador ya no borrará tus datos solo.' : 'El navegador no lo ha concedido. Guarda una copia.');
    } catch {
      ui.notify('Este navegador no deja pedirlo.');
    }
  };

  const copiar = async () => {
    setBusy(true);
    try {
      const bundle = await exportAll();
      const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `fitme-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
      ui.notify('Copia descargada. Guárdala en Archivos o mándatela por correo.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Sheet title="Tus datos" subtitle="Dónde están y cómo no perderlos" onClose={onClose}>
      {/* ── Copia, lo primero: es lo que de verdad lo arregla ── */}
      <div className="panel tint-mint" style={{ display: 'block' }}>
        <p className="note tight" style={{ marginBottom: 10 }}>
          <b>Haz una copia de vez en cuando.</b> Es un archivo que se guarda en tu móvil y que puedes
          volver a cargar aquí mismo. Mientras no tengas cuenta, es la única red.
        </p>
        <div className="btns">
          <button className="btn primary sm" disabled={busy} onClick={() => void copiar()}>
            <Icon name="weight" size={16} /> Guardar copia
          </button>
          <label className="btn sm" style={{ cursor: 'pointer' }}>
            Restaurar
            <input type="file" accept="application/json" className="sr-only" onChange={async (e) => {
              const file = e.target.files?.[0];
              if (!file) return;
              try {
                const bundle = JSON.parse(await file.text()) as ExportBundle;
                await importAll(bundle, 'merge');
                ui.notify('Restaurado y combinado con lo que ya había.');
              } catch (err) {
                ui.notify(err instanceof Error ? err.message : 'No se ha podido leer el archivo.');
              }
              e.target.value = '';
            }} />
          </label>
        </div>
      </div>

      {/* ── Estado del almacén ── */}
      <section className="section">
        <h3 className="section-title">Cómo está ahora</h3>
        <div className="plan-kv">
          <span>Almacenamiento permanente</span>
          <b>
            {estado.persistente === null ? 'No se sabe'
              : estado.persistente ? 'Concedido' : 'No concedido'}
          </b>
        </div>
        {estado.usado != null && (
          <div className="plan-kv">
            <span>Ocupan</span>
            <b>{(estado.usado / 1024 / 1024).toFixed(1)} MB</b>
          </div>
        )}
        <div className="plan-kv">
          <span>Abierta como</span>
          <b>{estado.instalada ? 'App instalada' : 'Pestaña del navegador'}</b>
        </div>
        {estado.persistente === false && (
          <>
            <p className="note" style={{ color: 'var(--over)' }}>
              Sin permanencia, el navegador puede borrar tus datos si le falta espacio, y Safari lo hace
              tras unos días sin abrir la página.
            </p>
            <button className="btn sm" onClick={() => void pedirPersistencia()}>Pedirlo otra vez</button>
          </>
        )}
      </section>

      {/* ── La trampa que se los hizo perder ── */}
      <section className="section">
        <h3 className="section-title">Por qué pueden no aparecer</h3>
        <div className="plan-note">
          <Icon name="bulb" size={16} />
          <p>
            <b>El icono de la pantalla de inicio y Safari no siempre comparten almacén.</b> Si registraste
            desde el icono y luego abres el enlace en Safari, ahí no hay nada: no se ha borrado, está en
            el otro sitio. Usa siempre la misma vía.
          </p>
        </div>
        <div className="plan-note">
          <Icon name="bell" size={16} />
          <p>
            <b>La dirección tiene que ser exacta.</b> Las mayúsculas cuentan:
            {' '}<code>nachopeza.github.io/FitMe/</code>. Otra dirección es, para el navegador, otro sitio.
          </p>
        </div>
        <div className="plan-note">
          <Icon name="star" size={16} />
          <p>
            <b>Instálala en la pantalla de inicio.</b> Instalada, Safari no borra sus datos por
            inactividad, y es la forma de que duren.
          </p>
        </div>
      </section>
    </Sheet>
  );
}
