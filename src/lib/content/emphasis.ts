// Guidance strings mark a safety point as `**…**` bold (guidance.ts). The UI
// renders the marked text as <strong> through EmphasisText.svelte, which
// builds elements from these segments, never through {@html}, so a guidance
// string cannot inject markup.

type EmphasisSegment = { text: string; strong: boolean };

const MARKER = '**';

/**
 * Splits `text` on its `**` markers into ordered plain and strong segments.
 * Markers pair from left to right; with an odd count, the last marker has no
 * pair and stays in the plain text. Empty segments are dropped, so a string
 * without markers is one plain segment.
 */
export function splitEmphasis(text: string): EmphasisSegment[] {
  const parts = text.split(MARKER);
  // An even part count means an odd marker count: put the unpaired last
  // marker back between the last two parts, both plain.
  if (parts.length % 2 === 0) parts.push(parts.splice(-2).join(MARKER));
  return parts.map((part, i) => ({ text: part, strong: i % 2 === 1 })).filter((s) => s.text !== '');
}
