import * as m from '$lib/paraglide/messages';

export const TEXTURE_VALUES = [
  'lisse',
  'moulinee',
  'ecrasee',
  'petits-morceaux',
  'morceaux',
  'finger'
] as const;

export type TextureKey = (typeof TEXTURE_VALUES)[number];

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

export function isTextureKey(value: unknown): value is TextureKey {
  return typeof value === 'string' && (TEXTURE_VALUES as readonly string[]).includes(value);
}

/**
 * Age-by-month → default texture for the log sheet pre-selection.
 * `finger` is parallel/opt-in and never returned as a default.
 */
export function defaultTextureForAgeMonths(months: number): TextureKey {
  if (months < 6) return 'lisse';
  if (months < 7) return 'moulinee';
  if (months < 9) return 'ecrasee';
  if (months < 12) return 'petits-morceaux';
  return 'morceaux';
}
