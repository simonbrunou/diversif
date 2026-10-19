import { describe, expect, it } from 'bun:test';
import { TTL_BY_SEVERITY, keyFamily, ttlForReminderKey } from './dismissal-ttl';

describe('keyFamily', () => {
  it('keeps the key up to its first colon', () => {
    expect(keyFamily('maintain-allergen:oeuf:20000')).toBe('maintain-allergen');
    expect(keyFamily('welcome')).toBe('welcome');
  });
});

describe('ttlForReminderKey', () => {
  it('falls back to the info TTL for an unknown family, prototype names included', () => {
    expect(ttlForReminderKey('constructor')).toBe(TTL_BY_SEVERITY.info);
    expect(ttlForReminderKey('__proto__:x')).toBe(TTL_BY_SEVERITY.info);
  });
});
