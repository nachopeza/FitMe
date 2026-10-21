import type { FoodCategory } from '../domain/types';

/**
 * Dibujos de comida.
 *
 * En la referencia cada comida lleva una foto del plato. Fotos reales no se
 * pueden poner: harían falta cientos, con su licencia, y la app tiene que
 * funcionar sin conexión. Así que van dibujadas por categoría —una por tipo de
 * alimento— con los colores del sistema. Dan la textura que faltaba sin fingir
 * que hay una foto de lo que comiste.
 */

const ART: Record<FoodCategory, { bg: string; art: React.ReactNode }> = {
  protein: {
    bg: 'var(--c-protein-bg)',
    art: (
      <>
        <ellipse cx="24" cy="30" rx="15" ry="10" fill="#c8763f" />
        <ellipse cx="24" cy="27.5" rx="15" ry="10" fill="#e08c4e" />
        <path d="M14 26c3-2 8-3 12-2" stroke="#b9682f" strokeWidth="2" strokeLinecap="round" fill="none" />
        <circle cx="31" cy="24" r="2" fill="#f3b276" />
      </>
    ),
  },
  carb: {
    bg: 'var(--c-carbs-bg)',
    art: (
      <>
        <path d="M11 30c0-7 6-12 13-12s13 5 13 12z" fill="#e8a65c" />
        <path d="M11 30h26v3a2 2 0 0 1-2 2H13a2 2 0 0 1-2-2z" fill="#cf8a43" />
        <circle cx="19" cy="25" r="1.6" fill="#f6cf9c" />
        <circle cx="27" cy="23" r="1.6" fill="#f6cf9c" />
      </>
    ),
  },
  vegetable: {
    bg: 'var(--c-fiber-bg)',
    art: (
      <>
        <circle cx="19" cy="24" r="7" fill="#4f9e59" />
        <circle cx="28" cy="22" r="5.5" fill="#67b471" />
        <circle cx="25" cy="30" r="6" fill="#3f8c4a" />
        <path d="M19 31v4M28 28v6" stroke="#2f6e38" strokeWidth="2" strokeLinecap="round" />
      </>
    ),
  },
  fruit: {
    bg: 'var(--c-carbs-bg)',
    art: (
      <>
        <path d="M14 20c4-4 9-3 11 1 4-6 12-2 11 5-1 8-9 13-13 13S12 33 12 26c0-2 .7-4.4 2-6z" fill="#e8604c" />
        <path d="M25 20c0-3 2-5 5-5-0 3-2 5-5 5z" fill="#4f9e59" />
        <circle cx="19" cy="26" r="2.6" fill="#f08a78" />
      </>
    ),
  },
  dairy: {
    bg: 'var(--c-protein-bg)',
    art: (
      <>
        <path d="M16 17h16l-2 19a3 3 0 0 1-3 2.6h-6A3 3 0 0 1 18 36z" fill="#eef3fb" />
        <path d="M16.6 24h14.8l-1.4 12a3 3 0 0 1-3 2.6h-6a3 3 0 0 1-3-2.6z" fill="#cfe0f7" />
        <rect x="15" y="14" width="18" height="4" rx="2" fill="#a9c8ef" />
      </>
    ),
  },
  fat: {
    bg: 'var(--c-fat-bg)',
    art: (
      <>
        <circle cx="19" cy="27" r="6.5" fill="#9b7a4e" />
        <circle cx="28" cy="24" r="5.5" fill="#b08f60" />
        <circle cx="27" cy="32" r="5" fill="#8a6a42" />
        <circle cx="17.5" cy="25.5" r="1.6" fill="#c7a876" />
      </>
    ),
  },
  drink: {
    bg: 'var(--c-kcal-bg)',
    art: (
      <>
        <path d="M15 16h18l-2.4 21a3 3 0 0 1-3 2.6h-7.2a3 3 0 0 1-3-2.6z" fill="#d8c3a4" />
        <path d="M16.2 22h15.6l-1.8 15a3 3 0 0 1-3 2.6h-6a3 3 0 0 1-3-2.6z" fill="#8a5a33" />
        <ellipse cx="24" cy="22" rx="7.8" ry="2.2" fill="#c9a278" />
      </>
    ),
  },
  other: {
    bg: 'var(--paper-2)',
    art: (
      <>
        <circle cx="24" cy="27" r="12" fill="#cfd6e2" />
        <circle cx="24" cy="27" r="7" fill="#e6eaf2" />
      </>
    ),
  },
};

export function FoodArt({ category, size = 50 }: { category: FoodCategory; size?: number }) {
  const { bg, art } = ART[category] ?? ART.other;
  return (
    <span className="food-art" style={{ width: size, height: size, background: bg }} aria-hidden="true">
      <svg viewBox="0 0 48 48">{art}</svg>
    </span>
  );
}

/**
 * Ilustración de la tarjeta de consejo: una mancuerna y una manzana.
 * En la referencia ocupa la esquina derecha de la tarjeta verde.
 */
export function TipArt() {
  return (
    <svg className="tip-art" viewBox="0 0 92 64" aria-hidden="true">
      <g transform="translate(2 10)">
        <rect x="6" y="14" width="7" height="22" rx="3" fill="#2f3b4d" />
        <rect x="31" y="14" width="7" height="22" rx="3" fill="#2f3b4d" />
        <rect x="0" y="19" width="6" height="12" rx="3" fill="#48566c" />
        <rect x="38" y="19" width="6" height="12" rx="3" fill="#48566c" />
        <rect x="12" y="22" width="20" height="6" rx="3" fill="#5b6a82" />
      </g>
      <g transform="translate(50 8)">
        <path d="M8 12c3-3 7-2.4 8.6.8C19.8 7 26 10 25.2 15.6 24.4 22 18.4 26 15.2 26S6 22 6 16.4c0-1.6.6-3.4 2-4.4z" fill="#e8604c" />
        <path d="M16 12c0-2.4 1.6-4 4-4 0 2.4-1.6 4-4 4z" fill="#4f9e59" />
      </g>
    </svg>
  );
}

/** Flecha ascendente de la tarjeta "¿Cómo vas?". */
export function TrendArt() {
  return (
    <svg className="trend-art" viewBox="0 0 64 36" aria-hidden="true">
      <path d="M4 30l12-11 9 7 14-17" fill="none" stroke="var(--accent)" strokeWidth="4"
        strokeLinecap="round" strokeLinejoin="round" />
      <path d="M48 7h8v8" fill="none" stroke="var(--accent)" strokeWidth="4"
        strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
