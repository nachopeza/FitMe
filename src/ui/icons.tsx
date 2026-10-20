/**
 * Iconos de línea.
 *
 * SVG en línea sobre rejilla de 24 px, con `currentColor` y trazo variable: el
 * estado activo engrosa el trazo en vez de cargar un segundo juego. Sustituyen
 * a los emoji, que descuadraban las celdas estrechas y se dibujan distinto en
 * cada sistema.
 */

export type IconName =
  | 'today' | 'macros' | 'progress' | 'profile' | 'plus'
  | 'coffee' | 'bread' | 'bowl' | 'sandwich' | 'shake' | 'plate'
  | 'mic' | 'camera' | 'barcode' | 'tag' | 'star' | 'pen'
  | 'dumbbell' | 'timer' | 'check' | 'search' | 'trash' | 'chevron'
  | 'weight' | 'steps' | 'book' | 'cart' | 'flame';

interface IconProps {
  name: IconName;
  size?: number;
  active?: boolean;
}

export function Icon({ name, size = 24, active = false }: IconProps) {
  const p = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: active ? 2.1 : 1.7,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };

  switch (name) {
    case 'today':
      return (
        <svg {...p}>
          <path d="M9 6.5h11M9 12h11M9 17.5h7.5" />
          <path d="M4.4 6.5h.01M4.4 12h.01M4.4 17.5h.01" strokeWidth={active ? 2.8 : 2.4} />
        </svg>
      );
    case 'macros':
      return (
        <svg {...p}>
          <path d="M6 20V11.5M12 20V4.5M18 20v-6" />
          <path d="M3.5 20h17" opacity={active ? 1 : 0.5} />
        </svg>
      );
    case 'progress':
      return (
        <svg {...p}>
          <path d="M3.5 19.5h17" opacity={active ? 1 : 0.5} />
          <path d="M5.5 15.5l4-4.5 3.2 3 5.8-7" />
          <path d="M18.5 7h-3.2M18.5 7v3.2" />
        </svg>
      );
    case 'profile':
      return (
        <svg {...p}>
          <circle cx="12" cy="8.2" r="3.9" />
          <path d="M4.6 20.2c1-3.7 3.9-5.7 7.4-5.7s6.4 2 7.4 5.7" />
        </svg>
      );
    case 'plus':
      return <svg {...p} strokeWidth={2.2}><path d="M12 5.5v13M5.5 12h13" /></svg>;
    case 'check':
      return <svg {...p} strokeWidth={2.4}><path d="M5 12.5l4.5 4.5L19 7" /></svg>;
    case 'chevron':
      return <svg {...p}><path d="M9 5l7 7-7 7" /></svg>;

    // Comida
    case 'coffee':
      return (
        <svg {...p}>
          <path d="M4 9h12v6a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V9z" />
          <path d="M16 10.5h2.2a2.3 2.3 0 0 1 0 4.6H16" />
          <path d="M7.5 3.5v2M11 3.5v2" opacity={0.6} />
        </svg>
      );
    case 'bread':
      return (
        <svg {...p}>
          <path d="M4 10.5c0-2.5 2.4-4 5.5-4h5C17.6 6.5 20 8 20 10.5c0 1.4-1 2.2-2.2 2.2v4.3a1.5 1.5 0 0 1-1.5 1.5H7.7a1.5 1.5 0 0 1-1.5-1.5v-4.3C5 12.7 4 11.9 4 10.5z" />
        </svg>
      );
    case 'bowl':
      return (
        <svg {...p}>
          <path d="M3.5 10.5h17a8.5 8.5 0 0 1-8.5 8.5 8.5 8.5 0 0 1-8.5-8.5z" />
          <path d="M9 7c0-1.2.8-2 .8-3M13.5 7c0-1.2.8-2 .8-3" opacity={0.6} />
        </svg>
      );
    case 'sandwich':
      return (
        <svg {...p}>
          <path d="M3.5 8.5l8.5-4 8.5 4-8.5 4z" />
          <path d="M3.5 12.5l8.5 4 8.5-4" />
          <path d="M3.5 16l8.5 4 8.5-4" opacity={0.6} />
        </svg>
      );
    case 'shake':
      return (
        <svg {...p}>
          <path d="M7 8h10l-1 11.2a1.8 1.8 0 0 1-1.8 1.6H9.8A1.8 1.8 0 0 1 8 19.2z" />
          <path d="M6 8c0-2.5 2.7-4.5 6-4.5S18 5.5 18 8" />
          <path d="M9.5 12.5h5" opacity={0.6} />
        </svg>
      );
    case 'plate':
      return (
        <svg {...p}>
          <circle cx="12" cy="12" r="8.3" />
          <circle cx="12" cy="12" r="4.2" opacity={0.55} />
        </svg>
      );
    case 'flame':
      return (
        <svg {...p}>
          <path d="M12 3.5s4.8 3.6 4.8 8.2a4.8 4.8 0 0 1-9.6 0c0-1.6.8-2.9 1.6-3.8.3 1 .9 1.8 1.7 2.1-.3-2.4.6-4.8 1.5-6.5z" />
        </svg>
      );

    // Captura
    case 'mic':
      return (
        <svg {...p}>
          <rect x="9" y="3" width="6" height="11" rx="3" />
          <path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v3" />
        </svg>
      );
    case 'camera':
      return (
        <svg {...p}>
          <path d="M3.5 8.5h3.2l1.5-2.4h7.6l1.5 2.4h3.2v10a1.5 1.5 0 0 1-1.5 1.5H5a1.5 1.5 0 0 1-1.5-1.5z" />
          <circle cx="12" cy="13.5" r="3.4" />
        </svg>
      );
    case 'barcode':
      return (
        <svg {...p}>
          <path d="M4 6v12M7.5 6v12M11 6v8M14.5 6v12M18 6v12" />
          <path d="M20.5 6v12" opacity={0.5} />
        </svg>
      );
    case 'tag':
      return (
        <svg {...p}>
          <path d="M4 4h7.2l8.3 8.3a1.5 1.5 0 0 1 0 2.1l-5.1 5.1a1.5 1.5 0 0 1-2.1 0L4 11.2z" />
          <path d="M8 8h.01" strokeWidth={2.4} />
        </svg>
      );
    case 'star':
      return (
        <svg {...p}>
          <path d="M12 3.8l2.5 5.2 5.7.8-4.1 4 1 5.6-5.1-2.7-5.1 2.7 1-5.6-4.1-4 5.7-.8z" />
        </svg>
      );
    case 'pen':
      return (
        <svg {...p}>
          <path d="M4 20h4l10.5-10.5a2.1 2.1 0 0 0-3-3L5 17v3z" />
          <path d="M14.5 6.5l3 3" />
        </svg>
      );

    // Entrenamiento
    case 'dumbbell':
      // Discos y barra. La versión anterior, a base de rayas verticales, se
      // leía como una "H" entre palotes.
      return (
        <svg {...p}>
          <rect x="6" y="6.5" width="3.6" height="11" rx="1.4" />
          <rect x="14.4" y="6.5" width="3.6" height="11" rx="1.4" />
          <path d="M9.6 12h4.8" />
          <path d="M3.2 9.5v5M20.8 9.5v5" />
        </svg>
      );
    case 'timer':
      return (
        <svg {...p}>
          <circle cx="12" cy="13.5" r="7.5" />
          <path d="M12 9.5v4.2l2.6 1.6M9.5 3h5" />
        </svg>
      );
    case 'weight':
      return (
        <svg {...p}>
          <path d="M5.2 8h13.6l1.7 11.3a1.5 1.5 0 0 1-1.5 1.7H5a1.5 1.5 0 0 1-1.5-1.7z" />
          <path d="M9 8a3 3 0 0 1 6 0" />
        </svg>
      );
    case 'steps':
      return (
        <svg {...p}>
          <path d="M7.5 14.5c-1.8 0-2.6-1.4-2.6-3.6 0-2.8 1-6.4 3.1-6.4 1.7 0 2.3 1.7 2.3 3.6 0 2.3-.6 6.4-2.8 6.4z" />
          <path d="M6 16.5h3.4c.7 0 1.2.6 1.1 1.3l-.2 1.4c-.1.7-.7 1.2-1.4 1.2H7.3c-.8 0-1.4-.6-1.4-1.4z" />
          <path d="M16.8 11.5c1.8 0 2.6-1.4 2.6-3.6 0-2.8-1-5.4-3.1-5.4-1.7 0-2.3 1.7-2.3 3.6 0 2.3.6 5.4 2.8 5.4z" opacity={0.55} />
        </svg>
      );

    // Otros
    case 'search':
      return <svg {...p}><circle cx="11" cy="11" r="6.5" /><path d="M16 16l4.5 4.5" /></svg>;
    case 'trash':
      return (
        <svg {...p}>
          <path d="M4.5 6.5h15M9.5 6.5V4.8c0-.7.6-1.3 1.3-1.3h2.4c.7 0 1.3.6 1.3 1.3v1.7" />
          <path d="M6.5 6.5l.9 12.2c.05.7.65 1.3 1.35 1.3h6.5c.7 0 1.3-.6 1.35-1.3l.9-12.2" />
        </svg>
      );
    case 'book':
      return (
        <svg {...p}>
          <path d="M5 4.5h10.5a3.5 3.5 0 0 1 3.5 3.5v11.5H8.5A3.5 3.5 0 0 1 5 16z" />
          <path d="M5 16a3.5 3.5 0 0 1 3.5-3.5H19" opacity={0.55} />
        </svg>
      );
    case 'cart':
      return (
        <svg {...p}>
          <path d="M3 4.5h2.3l2.2 10.3h9.3l2-7.3H6" />
          <circle cx="9.5" cy="19" r="1.4" />
          <circle cx="16.5" cy="19" r="1.4" />
        </svg>
      );
  }
}
