/**
 * Iconos de línea para la barra inferior.
 *
 * SVG en línea, con `currentColor` y grosor de trazo variable: así el estado
 * activo se marca engrosando el trazo y cambiando el color, sin cargar dos
 * juegos de iconos ni depender de una fuente de iconos externa.
 *
 * Trazado sobre una rejilla de 24 px con extremos y uniones redondeados, que es
 * lo que da el aire de los iconos de iOS.
 */

export type IconName = 'today' | 'macros' | 'progress' | 'profile' | 'plus';

interface IconProps {
  name: IconName;
  /** Tamaño en píxeles. */
  size?: number;
  /** El estado activo usa un trazo algo más grueso. */
  active?: boolean;
}

export function Icon({ name, size = 24, active = false }: IconProps) {
  const sw = active ? 2.1 : 1.6;
  const common = {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: sw,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  };

  switch (name) {
    // Día: la lista de comidas, con sus viñetas.
    case 'today':
      return (
        <svg {...common}>
          <path d="M9 6.5h11M9 12h11M9 17.5h7.5" />
          <path d="M4.4 6.5h.01M4.4 12h.01M4.4 17.5h.01" strokeWidth={active ? 2.8 : 2.4} />
        </svg>
      );

    // Macros: tres barras de distinta altura.
    case 'macros':
      return (
        <svg {...common}>
          <path d="M6 20V11.5M12 20V4.5M18 20v-6" />
          <path d="M3.5 20h17" opacity={active ? 1 : 0.55} />
        </svg>
      );

    // Progreso: línea de tendencia ascendente.
    case 'progress':
      return (
        <svg {...common}>
          <path d="M3.5 19.5h17" opacity={active ? 1 : 0.55} />
          <path d="M5.5 15.5l4-4.5 3.2 3 5.8-7" />
          <path d="M18.5 7h-3.2M18.5 7v3.2" />
        </svg>
      );

    // Perfil: cabeza y hombros.
    case 'profile':
      return (
        <svg {...common}>
          <circle cx="12" cy="8.2" r="3.9" />
          <path d="M4.6 20.2c1-3.7 3.9-5.7 7.4-5.7s6.4 2 7.4 5.7" />
        </svg>
      );

    // Añadir.
    case 'plus':
      return (
        <svg {...common} strokeWidth={2.2}>
          <path d="M12 5.5v13M5.5 12h13" />
        </svg>
      );
  }
}
