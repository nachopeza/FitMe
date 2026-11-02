import { describe, expect, it } from 'vitest';
import { inspectKey } from './api';

/** Un JWT de mentira con el papel que se le diga dentro. */
const jwt = (role: string) => {
  const b64 = (o: unknown) => btoa(JSON.stringify(o)).replace(/=+$/, '');
  return `${b64({ alg: 'HS256' })}.${b64({ role, iss: 'supabase' })}.firma-de-mentira`;
};

describe('inspectKey', () => {
  it('acepta la clave pública nueva', () => {
    expect(inspectKey('sb_publishable_abcdefghijklmnopqrstuvwxyz')).toEqual({ ok: true });
  });

  it('acepta la anon de siempre', () => {
    expect(inspectKey(jwt('anon'))).toEqual({ ok: true });
  });

  it('rechaza la secreta nueva y explica el riesgo', () => {
    const r = inspectKey('sb_secret_abcdefghijklmnopqrstuvwxyz');
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toMatch(/SECRETA/);
  });

  it('rechaza service_role, que es la que abriría la base entera', () => {
    const r = inspectKey(jwt('service_role'));
    expect(r.ok).toBe(false);
    expect(r.ok === false && r.reason).toMatch(/service_role/);
  });

  it('una clave corta es un recorte al copiar', () => {
    expect(inspectKey('eyJhbGci').ok).toBe(false);
  });

  it('no bloquea un formato que no conoce: quedarse sin cuenta es peor', () => {
    expect(inspectKey('una-clave-rarisima-pero-larga-de-otro-proveedor')).toEqual({ ok: true });
  });
});
