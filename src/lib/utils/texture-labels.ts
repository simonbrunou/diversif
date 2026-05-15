import * as m from '$lib/paraglide/messages';
import { TEXTURE_VALUES, type TextureKey } from './textures';

const LABEL_FNS: Record<TextureKey, () => string> = {
  lisse: m.textureLisse,
  moulinee: m.textureMoulinee,
  ecrasee: m.textureEcrasee,
  'petits-morceaux': m.texturePetitsMorceaux,
  morceaux: m.textureMorceaux,
  finger: m.textureFinger
};

export function getTextureLabel(key: TextureKey): string {
  return LABEL_FNS[key]();
}

export { TEXTURE_VALUES, type TextureKey };
