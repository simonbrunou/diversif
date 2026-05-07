import { describe, expect, it, vi } from 'vitest';
import { newId } from './uuid';

describe('newId', () => {
  it('returns a v4-shaped UUID', () => {
    const id = newId();
    expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/);
  });

  it('returns distinct ids on repeated calls', () => {
    const a = newId();
    const b = newId();
    expect(a).not.toBe(b);
  });

  it('uses crypto.randomUUID when available', () => {
    const spy = vi.spyOn(globalThis.crypto, 'randomUUID');
    newId();
    expect(spy).toHaveBeenCalled();
  });
});
