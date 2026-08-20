import { describe, expect, it } from 'bun:test';
import { TEXTURE_VALUES, defaultTextureForAgeMonths, isTextureKey } from './textures';

describe('textures', () => {
  it('TEXTURE_VALUES is the 6 known keys in progression order, finger last', () => {
    expect(TEXTURE_VALUES).toEqual([
      'lisse',
      'moulinee',
      'ecrasee',
      'petits-morceaux',
      'morceaux',
      'finger'
    ]);
  });

  it('isTextureKey accepts known keys and rejects unknown', () => {
    expect(isTextureKey('lisse')).toBe(true);
    expect(isTextureKey('finger')).toBe(true);
    expect(isTextureKey('foo')).toBe(false);
    expect(isTextureKey(null)).toBe(false);
  });

  it('defaultTextureForAgeMonths maps ranges deterministically', () => {
    expect(defaultTextureForAgeMonths(3)).toBe('lisse');
    expect(defaultTextureForAgeMonths(4)).toBe('lisse');
    expect(defaultTextureForAgeMonths(5.9)).toBe('lisse');
    expect(defaultTextureForAgeMonths(6)).toBe('moulinee');
    expect(defaultTextureForAgeMonths(6.9)).toBe('moulinee');
    expect(defaultTextureForAgeMonths(7)).toBe('ecrasee');
    expect(defaultTextureForAgeMonths(7.9)).toBe('ecrasee');
    expect(defaultTextureForAgeMonths(8)).toBe('petits-morceaux');
    expect(defaultTextureForAgeMonths(9)).toBe('petits-morceaux');
    expect(defaultTextureForAgeMonths(9.9)).toBe('petits-morceaux');
    expect(defaultTextureForAgeMonths(10)).toBe('morceaux');
    expect(defaultTextureForAgeMonths(36)).toBe('morceaux');
  });

  it('defaultTextureForAgeMonths never returns finger (finger is opt-in)', () => {
    for (let m = 0; m <= 48; m += 0.5) {
      expect(defaultTextureForAgeMonths(m)).not.toBe('finger');
    }
  });
});
