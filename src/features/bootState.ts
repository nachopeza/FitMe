import type { Profile } from '../domain/types';

/**
 * Decide qué se muestra al arrancar: el cargador, el onboarding o la app.
 *
 * Está aparte y es pura porque aquí vivía el fallo más grave que ha tenido la
 * app: se confundía «el perfil todavía no ha cargado» con «no hay perfil», así
 * que en cada arranque asomaba el onboarding, y completarlo sobrescribía el
 * perfil real. Desde fuera parecía que la app borrase los datos al abrirla.
 *
 * La regla es: mientras cualquier dato necesario siga en vuelo, se espera.
 * Nunca se concluye «no hay perfil» por un `undefined`.
 */
export interface BootInput {
  /** true cuando la base de datos está abierta y sembrada. */
  seeded: boolean;
  /** `undefined` = consulta en vuelo · `null` = no existe · objeto = existe. */
  profile: Profile | null | undefined;
  /** Número de alimentos cargados. Cero significa que aún no han llegado. */
  foodCount: number;
}

export type BootPhase = 'loading' | 'onboarding' | 'app';

export function bootPhase(input: BootInput): BootPhase {
  const { seeded, profile, foodCount } = input;
  if (!seeded) return 'loading';
  // Solo un null explícito autoriza a lanzar el onboarding.
  if (profile === null) return 'onboarding';
  if (profile === undefined) return 'loading';
  if (foodCount === 0) return 'loading';
  return 'app';
}
