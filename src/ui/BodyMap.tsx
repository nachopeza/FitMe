import type { MuscleGroup } from '../domain/types';

/**
 * Mapa corporal con lo trabajado.
 *
 * Dos siluetas, de frente y de espalda, con los grupos que ha tocado la sesión
 * encendidos y con más intensidad cuantas más series. Es lo único que dice de
 * un vistazo si una semana se ha quedado coja de pierna o de espalda, cosa que
 * una lista de nombres no consigue.
 *
 * La figura se arma por piezas —cabeza, torso, brazos, piernas— en lugar de con
 * un contorno único: así los brazos quedan separados del tronco y cada zona
 * encendida cae exactamente sobre su miembro.
 */

type Side = 'front' | 'back';

/** La silueta, igual en las dos vistas. */
const BODY = [
  'M50 5a13 13 0 1 1-.01 0',                      // cabeza
  'M44 29h12v8H44z',                               // cuello
  'M28 35h44a5 5 0 0 1 5 5l1 9-11 2-2-6v2H33v-2l-2 6-11-2 1-9a5 5 0 0 1 5-5z', // hombros
  'M31 44h38l-4 52H35z',                           // tronco
  'M33 94h34l2 16H31z',                            // cadera
  'M19 46h11l-3 32H16z',                           // brazo izquierdo
  'M70 46h11l3 32H73z',                            // brazo derecho
  'M16 78h11l-2 32H14z',                           // antebrazo izquierdo
  'M73 78h11l2 32H75z',                            // antebrazo derecho
  'M33 108h15l-2 44H34z',                          // muslo izquierdo
  'M52 108h15l1 44H54z',                           // muslo derecho
  'M35 152h11l-1 38H35z',                          // gemelo izquierdo
  'M54 152h11l-1 38H54z',                          // gemelo derecho
];

/** Qué zonas de cada silueta corresponden a cada grupo. */
const SHAPES: Partial<Record<MuscleGroup, { side: Side; d: string }[]>> = {
  chest: [{ side: 'front', d: 'M33 47h15v18H35zM52 47h15l-2 18H52z' }],
  shoulders: [
    { side: 'front', d: 'M20 40a7 7 0 0 1 10-4l1 12-11 2zM80 40a7 7 0 0 0-10-4l-1 12 11 2z' },
    { side: 'back', d: 'M20 40a7 7 0 0 1 10-4l1 12-11 2zM80 40a7 7 0 0 0-10-4l-1 12 11 2z' },
  ],
  back: [{ side: 'back', d: 'M32 46h36l-3 34H35z' }],
  biceps: [{ side: 'front', d: 'M22 50h8l-2 24h-8zM78 50h-8l2 24h8z' }],
  triceps: [{ side: 'back', d: 'M19 50h8l-2 26h-8zM81 50h-8l2 26h8z' }],
  forearms: [
    { side: 'front', d: 'M17 80h9l-2 28h-9zM83 80h-9l2 28h9z' },
    { side: 'back', d: 'M17 80h9l-2 28h-9zM83 80h-9l2 28h9z' },
  ],
  core: [{ side: 'front', d: 'M39 66h22l-2 28H41z' }],
  quads: [{ side: 'front', d: 'M34 110h13l-2 40H35zM53 110h13l1 40H54z' }],
  hamstrings: [{ side: 'back', d: 'M34 112h13l-2 38H35zM53 112h13l1 38H54z' }],
  glutes: [{ side: 'back', d: 'M33 95h34l2 14H31z' }],
  calves: [{ side: 'back', d: 'M36 154h9l-1 34h-8zM55 154h9l-1 34h-8z' }],
};

/** Grupos que, al no mapear a una zona, se dicen con palabras. */
const UNMAPPED: MuscleGroup[] = ['fullBody', 'cardio'];

export function BodyMap({
  worked, size = 150,
}: {
  /** Series por grupo muscular. */
  worked: Map<MuscleGroup, number>;
  size?: number;
}) {
  const max = Math.max(1, ...worked.values());
  // Tres niveles: más series, más saturado. Más escalones no se distinguirían.
  const intensity = (m: MuscleGroup): number => {
    const sets = worked.get(m) ?? 0;
    if (!sets) return 0;
    const ratio = sets / max;
    return ratio > 0.66 ? 3 : ratio > 0.33 ? 2 : 1;
  };

  const silhouette = (side: Side) => (
    <svg viewBox="0 0 100 196" className="body-svg" aria-hidden="true">
      <g className="body-base">
        {BODY.map((d, i) => <path key={i} d={d} />)}
      </g>
      {Object.entries(SHAPES).flatMap(([muscle, shapes]) =>
        (shapes ?? [])
          .filter((sh) => sh.side === side)
          .map((sh, i) => {
            const level = intensity(muscle as MuscleGroup);
            if (!level) return null;
            return <path key={`${muscle}-${i}`} className={`body-on lvl-${level}`} d={sh.d} />;
          }),
      )}
    </svg>
  );

  const extra = UNMAPPED.filter((m) => worked.has(m));

  return (
    <div className="body-map" style={{ ['--body-size' as string]: `${size}px` }}>
      <figure>
        {silhouette('front')}
        <figcaption>Frente</figcaption>
      </figure>
      <figure>
        {silhouette('back')}
        <figcaption>Espalda</figcaption>
      </figure>
      {extra.length > 0 && (
        <p className="body-extra">
          {extra.includes('cardio') && 'Cardio'}
          {extra.length === 2 && ' y '}
          {extra.includes('fullBody') && 'cuerpo completo'}
          {' '}no se dibujan aquí.
        </p>
      )}
    </div>
  );
}
