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

/**
 * La silueta, igual en las dos vistas.
 *
 * El tronco, la cabeza y la cadera son formas rellenas; los brazos y las
 * piernas son TRAZOS con el remate redondo. Dibujar los miembros como trazo en
 * vez de como polígono es lo que hace que se vean como miembros y no como
 * piezas de Lego: se curvan, se afinan y acaban en redondo sin tener que
 * calcular contornos a mano.
 */
const BODY_FILL = [
  'M50 6a13 13 0 1 1-.01 0',                 // cabeza
  'M44 27h12l3 13H41z',                      // cuello y trapecio
  // Tronco con cintura: hombros anchos, cintura estrecha.
  'M28 42c2-6 8-9 15-9h14c7 0 13 3 15 9 2 10 1 20-2 28-2 7-5 12-6 18H36c-1-6-4-11-6-18-3-8-4-18-2-28z',
  'M35 86h30c2 9 0 17-4 21H39c-4-4-6-12-4-21z',  // cadera
];

/** Los miembros, como trazos: [camino, grosor]. */
const BODY_STROKE: [string, number][] = [
  ['M30 48c-7 6-11 16-13 28', 12],      // brazo izquierdo
  ['M70 48c7 6 11 16 13 28', 12],       // brazo derecho
  ['M17 76c-2 11-3 21-3 29', 9],        // antebrazo izquierdo
  ['M83 76c2 11 3 21 3 29', 9],         // antebrazo derecho
  ['M41 108c-1 13-2 24-2 34', 18],      // muslo izquierdo
  ['M59 108c1 13 2 24 2 34', 18],       // muslo derecho
  ['M39 146c0 13 0 25 1 36', 12.5],     // gemelo izquierdo
  ['M61 146c0 13 0 25-1 36', 12.5],     // gemelo derecho
];

/**
 * Qué zonas de cada silueta corresponden a cada grupo.
 *
 * Las de los miembros reutilizan EL MISMO camino que la silueta, con el mismo
 * grosor: así encajan exactamente, sin posibilidad de que una zona quede
 * descolocada respecto al brazo o a la pierna que pretende señalar.
 */
interface Shape { side: Side; d: string; w?: number }

const SHAPES: Partial<Record<MuscleGroup, Shape[]>> = {
  // Ceñidas al tronco: si se pasan por los lados, parecen pintadas sobre el
  // brazo en vez de sobre el pecho o la espalda.
  chest: [{ side: 'front', d: 'M34 45c4-2 9-3 14-3v20c-5 0-10-1-14-3-2-4-2-10 0-14z'
    + 'M66 45c-4-2-9-3-14-3v20c5 0 10-1 14-3 2-4 2-10 0-14z' }],
  back: [{ side: 'back', d: 'M32 44c6-4 30-4 36 0 2 9 1 19-2 26-1 4-3 7-4 10H38c-1-3-3-6-4-10-3-7-4-17-2-26z' }],
  core: [{ side: 'front', d: 'M41 64h18c0 8-1 15-2 22H43c-1-7-2-14-2-22z' }],
  shoulders: [
    { side: 'front', d: 'M30 48c-4 3-7 8-9 14', w: 12 },
    { side: 'back', d: 'M30 48c-4 3-7 8-9 14', w: 12 },
    { side: 'front', d: 'M70 48c4 3 7 8 9 14', w: 12 },
    { side: 'back', d: 'M70 48c4 3 7 8 9 14', w: 12 },
  ],
  biceps: [
    { side: 'front', d: 'M23 58c-3 5-5 11-6 18', w: 11.5 },
    { side: 'front', d: 'M77 58c3 5 5 11 6 18', w: 11.5 },
  ],
  triceps: [
    { side: 'back', d: 'M23 58c-3 5-5 11-6 18', w: 11.5 },
    { side: 'back', d: 'M77 58c3 5 5 11 6 18', w: 11.5 },
  ],
  forearms: [
    { side: 'front', d: 'M17 76c-2 11-3 21-3 29', w: 9 },
    { side: 'front', d: 'M83 76c2 11 3 21 3 29', w: 9 },
    { side: 'back', d: 'M17 76c-2 11-3 21-3 29', w: 9 },
    { side: 'back', d: 'M83 76c2 11 3 21 3 29', w: 9 },
  ],
  quads: [
    { side: 'front', d: 'M41 108c-1 13-2 24-2 34', w: 18 },
    { side: 'front', d: 'M59 108c1 13 2 24 2 34', w: 18 },
  ],
  hamstrings: [
    { side: 'back', d: 'M41 108c-1 13-2 24-2 34', w: 18 },
    { side: 'back', d: 'M59 108c1 13 2 24 2 34', w: 18 },
  ],
  glutes: [{ side: 'back', d: 'M35 86h30c2 9 0 17-4 21H39c-4-4-6-12-4-21z' }],
  calves: [
    { side: 'back', d: 'M39 146c0 13 0 25 1 36', w: 12.5 },
    { side: 'back', d: 'M61 146c0 13 0 25-1 36', w: 12.5 },
  ],
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
      <g className="body-fill">
        {BODY_FILL.map((d, i) => <path key={i} d={d} />)}
      </g>
      <g className="body-limbs">
        {BODY_STROKE.map(([d, w], i) => <path key={i} d={d} strokeWidth={w} />)}
      </g>
      {Object.entries(SHAPES).flatMap(([muscle, shapes]) =>
        (shapes ?? [])
          .filter((sh) => sh.side === side)
          .map((sh, i) => {
            const level = intensity(muscle as MuscleGroup);
            if (!level) return null;
            return (
              <path
                key={`${muscle}-${i}`}
                className={`body-on lvl-${level}${sh.w ? ' is-limb' : ''}`}
                d={sh.d}
                strokeWidth={sh.w}
              />
            );
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
