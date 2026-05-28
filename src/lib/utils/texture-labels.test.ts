import { describe, expect, it } from 'bun:test';
import * as m from '$lib/paraglide/messages';
import { TEXTURE_VALUES, getTextureLabel } from './texture-labels';

describe('texture-labels', () => {
  it('getTextureLabel returns the label for every key, in progression order', () => {
    expect(TEXTURE_VALUES.map(getTextureLabel)).toEqual([
      m.textureLisse(),
      m.textureMoulinee(),
      m.textureEcrasee(),
      m.texturePetitsMorceaux(),
      m.textureMorceaux(),
      m.textureFinger()
    ]);
  });
});
