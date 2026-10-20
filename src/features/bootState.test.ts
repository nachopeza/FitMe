import { describe, expect, it } from 'vitest';
import { bootPhase } from './bootState';
import { makeDefaultProfile } from '../data/db';

const profile = makeDefaultProfile();

describe('fase de arranque', () => {
  it('espera mientras la base de datos no está lista', () => {
    expect(bootPhase({ seeded: false, profile: undefined, foodCount: 0 })).toBe('loading');
    expect(bootPhase({ seeded: false, profile, foodCount: 116 })).toBe('loading');
  });

  /**
   * Este es EL caso que rompía la app: la base ya estaba abierta pero la
   * consulta del perfil seguía en vuelo. Antes se concluía que no había perfil
   * y se lanzaba el onboarding, que al completarse sobrescribía el perfil real.
   */
  it('NO lanza el onboarding mientras el perfil sigue cargando', () => {
    expect(bootPhase({ seeded: true, profile: undefined, foodCount: 116 })).toBe('loading');
    expect(bootPhase({ seeded: true, profile: undefined, foodCount: 0 })).toBe('loading');
  });

  it('solo lanza el onboarding cuando se confirma que no hay perfil', () => {
    expect(bootPhase({ seeded: true, profile: null, foodCount: 116 })).toBe('onboarding');
    // Y lo lanza aunque los alimentos aún no estén: el onboarding los carga solo.
    expect(bootPhase({ seeded: true, profile: null, foodCount: 0 })).toBe('onboarding');
  });

  it('entra en la app cuando está todo', () => {
    expect(bootPhase({ seeded: true, profile, foodCount: 116 })).toBe('app');
  });

  it('espera si el perfil existe pero los alimentos no han llegado', () => {
    expect(bootPhase({ seeded: true, profile, foodCount: 0 })).toBe('loading');
  });

  it('nunca pasa de cargando a onboarding teniendo perfil', () => {
    // Recorrido típico de un arranque con datos ya guardados.
    const secuencia = [
      bootPhase({ seeded: false, profile: undefined, foodCount: 0 }),
      bootPhase({ seeded: true, profile: undefined, foodCount: 0 }),
      bootPhase({ seeded: true, profile: undefined, foodCount: 116 }),
      bootPhase({ seeded: true, profile, foodCount: 116 }),
    ];
    expect(secuencia).toEqual(['loading', 'loading', 'loading', 'app']);
    expect(secuencia).not.toContain('onboarding');
  });
});
