import { describe, expect, it } from 'vitest';
import { decide, nextCursor, plan, type SyncStamp } from './sync';

const s = (id: string, updatedAt: number, deleted = false): SyncStamp => ({ id, updatedAt, deleted });

describe('qué hacer con un registro', () => {
  it('sube lo que no está en el servidor', () => {
    expect(decide(s('a', 100), null)).toBe('push');
  });

  it('baja lo que no está en el móvil', () => {
    expect(decide(null, s('a', 100))).toBe('pull');
  });

  it('gana la escritura más reciente', () => {
    expect(decide(s('a', 200), s('a', 100))).toBe('push');
    expect(decide(s('a', 100), s('a', 200))).toBe('pull');
  });

  it('si están iguales no se toca nada', () => {
    expect(decide(s('a', 100), s('a', 100))).toBe('skip');
  });

  it('un borrado más nuevo se propaga', () => {
    expect(decide(s('a', 100), s('a', 200, true))).toBe('pull');
    expect(decide(s('a', 200, true), s('a', 100))).toBe('push');
  });

  it('en un empate exacto, el borrado gana', () => {
    expect(decide(s('a', 100, true), s('a', 100))).toBe('push');
    expect(decide(s('a', 100), s('a', 100, true))).toBe('pull');
  });

  it('una edición vieja no resucita algo borrado después', () => {
    expect(decide(s('a', 50), s('a', 900, true))).toBe('pull');
  });

  it('sin fecha, ese lado se considera el más antiguo', () => {
    expect(decide({ id: 'a', updatedAt: Number.NaN }, s('a', 10))).toBe('pull');
    expect(decide(s('a', 10), { id: 'a', updatedAt: Number.NaN })).toBe('push');
  });

  it('con los dos lados vacíos no hay nada que hacer', () => {
    expect(decide(null, null)).toBe('skip');
  });
});

describe('el plan completo', () => {
  it('reparte cada registro a su lado', () => {
    const locals = [s('nuevo', 500), s('igual', 100), s('viejo', 10), s('mio', 900)];
    const remotes = [s('igual', 100), s('viejo', 300), s('suyo', 400), s('mio', 800)];
    expect(plan(locals, remotes)).toEqual({
      push: ['mio', 'nuevo'],
      pull: ['suyo', 'viejo'],
    });
  });

  it('con el servidor vacío se sube todo', () => {
    const locals = [s('a', 1), s('b', 2)];
    expect(plan(locals, [])).toEqual({ push: ['a', 'b'], pull: [] });
  });

  it('en un móvil recién instalado se baja todo', () => {
    const remotes = [s('a', 1), s('b', 2)];
    expect(plan([], remotes)).toEqual({ push: [], pull: ['a', 'b'] });
  });

  it('no pierde los borrados de ninguno de los dos lados', () => {
    const locals = [s('borrado-aqui', 900, true), s('vivo', 100)];
    const remotes = [s('borrado-aqui', 100), s('borrado-alli', 900, true), s('vivo', 100)];
    const p = plan(locals, remotes);
    expect(p.push).toContain('borrado-aqui');
    expect(p.pull).toContain('borrado-alli');
    expect(p.push).not.toContain('vivo');
    expect(p.pull).not.toContain('vivo');
  });

  it('sincronizar dos veces seguidas no mueve nada la segunda', () => {
    const locals = [s('a', 100), s('b', 200)];
    const remotes = [s('a', 100), s('b', 200)];
    expect(plan(locals, remotes)).toEqual({ push: [], pull: [] });
  });
});

describe('hasta dónde se da por traído', () => {
  it('usa el reloj del servidor con un margen hacia atrás', () => {
    expect(nextCursor(10_000)).toBe(8_000);
  });

  it('nunca devuelve una marca negativa', () => {
    expect(nextCursor(500)).toBe(0);
  });
});
