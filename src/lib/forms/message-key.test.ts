import { describe, expect, it } from 'bun:test';
import { resolveMessageKey } from './message-key';

// bunfig.preload.ts pins the test locale to French. Each test asserts the
// exact catalogue text (messages/fr.json), so a lookup that returned the key,
// the English text or the fallback for a known key fails.
describe('resolveMessageKey', () => {
  it('returns the resolved FR message for a known key', () => {
    expect(resolveMessageKey('chromeBack')).toBe('Retour');
  });

  it('falls back to the generic FR message for an unknown key', () => {
    expect(resolveMessageKey('notAMessageKey')).toBe('Une erreur s’est produite.');
  });
});
