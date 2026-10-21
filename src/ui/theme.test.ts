import { describe, expect, it } from 'vitest';
import { resolveTheme } from './theme';

// Lo que se rompió y por qué se prueba: la app seguía el modo del móvil sin
// que se le pidiera. La regla es que solo 'system' mira el móvil.
describe('resolveTheme', () => {
  it('claro y oscuro mandan, esté el móvil como esté', () => {
    expect(resolveTheme('light', true)).toBe('light');
    expect(resolveTheme('light', false)).toBe('light');
    expect(resolveTheme('dark', false)).toBe('dark');
    expect(resolveTheme('dark', true)).toBe('dark');
  });

  it('solo «según el móvil» sigue al móvil', () => {
    expect(resolveTheme('system', true)).toBe('dark');
    expect(resolveTheme('system', false)).toBe('light');
  });
});
