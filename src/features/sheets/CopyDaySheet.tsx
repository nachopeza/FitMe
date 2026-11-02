import { useMemo } from 'react';
import { formatDayLabel } from '../../domain/dates';
import type { IsoDate } from '../../domain/types';
import { Sheet, g } from '../../ui/components';
import { Icon } from '../../ui/icons';
import { useUI } from '../../ui/shell';
import { entryNutrients } from '../logging';
import { useApp } from '../store';

/**
 * Traer la comida de otro día.
 *
 * Come casi lo mismo a diario, así que volver a teclearlo cada mañana es la
 * fricción que acaba con el registro. Aquí elige un día ya registrado y se
 * copia entero a la fecha que está mirando; después lo cambia como quiera,
 * porque son comidas nuevas y no un enlace al original.
 *
 * Solo se ofrecen días CON comida: un día vacío no hay nada que copiar, y
 * enseñarlo sería ofrecer un botón que no hace nada.
 */
export function CopyDaySheet({ onClose }: { onClose: () => void }) {
  const app = useApp();
  const ui = useUI();

  /** Días con comida, del más reciente al más antiguo, sin contar el actual. */
  const dias = useMemo(() => {
    const out: { date: IsoDate; kcal: number; protein: number; comidas: number }[] = [];
    for (const date of app.daysWithFood) {
      if (date === app.date) continue;
      const entries = app.entriesByDate.get(date) ?? [];
      if (!entries.length) continue;
      let kcal = 0;
      let protein = 0;
      for (const e of entries) {
        const n = entryNutrients(e);
        kcal += n.kcal;
        protein += n.protein;
      }
      out.push({ date, kcal: Math.round(kcal), protein: Math.round(protein), comidas: entries.length });
    }
    return out.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 14);
  }, [app.daysWithFood, app.entriesByDate, app.date]);

  const yaHay = app.entries.length;

  const copiar = async (from: IsoDate) => {
    const ids = await app.actions.copyDay(from, app.date);
    onClose();
    if (ids.length) {
      ui.notify(
        `${ids.length} ${ids.length === 1 ? 'comida copiada' : 'comidas copiadas'} de ${formatDayLabel(from)}`,
        async () => { for (const id of ids) await app.actions.deleteEntry(id); },
      );
    }
  };

  return (
    <Sheet
      title="Traer otro día"
      subtitle={`Se copia a ${formatDayLabel(app.date)}`}
      onClose={onClose}
    >
      {yaHay > 0 && (
        <p className="note">
          Ojo: {app.isToday ? 'hoy' : 'ese día'} ya {yaHay === 1 ? 'tienes 1 comida' : `tienes ${yaHay} comidas`}.
          Lo copiado se añade, no sustituye.
        </p>
      )}

      {dias.length === 0 ? (
        <div className="empty">
          <strong>Todavía no hay ningún día que copiar</strong>
          En cuanto registres un día entero, podrás traerlo aquí con un toque y cambiar solo lo que varíe.
        </div>
      ) : (
        <div className="ex-list">
          {dias.map((d) => (
            <div className="ex-row" key={d.date}>
              <button className="ex-row-body" onClick={() => void copiar(d.date)}>
                <span className="chip-ico sm c-kcal"><Icon name="calendar" size={17} /></span>
                <span className="ex-row-text">
                  <span className="ex-row-name">{formatDayLabel(d.date)}</span>
                  <span className="ex-row-muscle">
                    {d.comidas} {d.comidas === 1 ? 'comida' : 'comidas'} · {g(d.kcal)} kcal · {g(d.protein)} g prot
                  </span>
                </span>
              </button>
              <button className="plan-add" onClick={() => void copiar(d.date)}
                aria-label={`Traer la comida de ${formatDayLabel(d.date)}`}>
                <Icon name="plus" size={17} />
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="note tight" style={{ marginTop: 14 }}>
        Se copian las comidas con sus cantidades y su hora. Luego puedes tocar cualquiera para cambiarla:
        son registros nuevos, así que editar la copia no toca el día original.
      </p>
    </Sheet>
  );
}
