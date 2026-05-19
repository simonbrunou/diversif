import { describe, it, expect, vi } from 'vitest';
import { trackSubmission, resolveMessageKey } from './tracked-enhance';

describe('trackSubmission', () => {
  it('flips the setter true on submit and false after update resolves', async () => {
    const setter = vi.fn();
    const onSubmit = trackSubmission(setter);
    const after = onSubmit();
    expect(setter).toHaveBeenLastCalledWith(true);
    const update = vi.fn(() => Promise.resolve());
    await after({ update });
    expect(update).toHaveBeenCalledOnce();
    expect(setter).toHaveBeenLastCalledWith(false);
    expect(setter).toHaveBeenCalledTimes(2);
  });
});

describe('resolveMessageKey', () => {
  it('returns the resolved FR message for a known key', () => {
    // chromeBack is a known key in the paraglide bundle.
    const out = resolveMessageKey('chromeBack');
    expect(typeof out).toBe('string');
    expect(out.length).toBeGreaterThan(0);
  });
});
