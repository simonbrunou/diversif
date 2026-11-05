import { describe, expect, it } from 'bun:test';
import { splitEmphasis } from './emphasis';

const plain = (text: string) => ({ text, strong: false });
const strong = (text: string) => ({ text, strong: true });

describe('splitEmphasis', () => {
  it('keeps a string without markers as one plain segment', () => {
    expect(splitEmphasis('Dès 4 mois, en purée lisse.')).toEqual([
      plain('Dès 4 mois, en purée lisse.')
    ]);
  });

  it('splits a marker pair at the start', () => {
    expect(splitEmphasis('**Jamais** de cacahuètes entières.')).toEqual([
      strong('Jamais'),
      plain(' de cacahuètes entières.')
    ]);
  });

  it('splits a marker pair in the middle', () => {
    expect(splitEmphasis('Le lait de vache **liquide** ne remplace pas.')).toEqual([
      plain('Le lait de vache '),
      strong('liquide'),
      plain(' ne remplace pas.')
    ]);
  });

  it('splits a marker pair at the end', () => {
    expect(splitEmphasis('En cas de malaise, **appeler le 15**')).toEqual([
      plain('En cas de malaise, '),
      strong('appeler le 15')
    ]);
  });

  it('splits two pairs in one string', () => {
    expect(splitEmphasis('**Jamais** seul, **toujours** assis.')).toEqual([
      strong('Jamais'),
      plain(' seul, '),
      strong('toujours'),
      plain(' assis.')
    ]);
  });

  it('keeps an unpaired marker as literal text', () => {
    expect(splitEmphasis('5 ** 2')).toEqual([plain('5 ** 2')]);
    expect(splitEmphasis('**Jamais** seul, ** assis.')).toEqual([
      strong('Jamais'),
      plain(' seul, ** assis.')
    ]);
    expect(splitEmphasis('fin **')).toEqual([plain('fin **')]);
  });
});
