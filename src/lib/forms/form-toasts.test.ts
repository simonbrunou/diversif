import { afterEach, beforeEach, describe, expect, it, mock } from 'bun:test';
import { flushSync } from 'svelte';

const success = mock((_message: string) => {});
const error = mock((_message: string) => {});
// Register the mock before pulling in the helper: svelte-sonner's real dist
// can't load under bun test (its 'runed' / 'svelte' peer imports don't
// resolve from the install cache), and static imports would hoist above
// mock.module — hence the dynamic imports below.
mock.module('svelte-sonner', () => ({ toast: { success, error } }));

const { mountFormToasts } = await import('../../test/form-toasts-harness.svelte');
const { resolveMessageKey } = await import('./tracked-enhance');

let harness: ReturnType<typeof mountFormToasts> | null = null;

beforeEach(() => {
  success.mockClear();
  error.mockClear();
});

afterEach(() => {
  harness?.destroy();
  harness = null;
});

describe('createFormToasts', () => {
  it('shows nothing while form is null', () => {
    harness = mountFormToasts({ successKey: 's', errorKey: 'e' });
    flushSync();
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('resolves the success key through paraglide and toasts it once', () => {
    harness = mountFormToasts({ successKey: 's', errorKey: 'e' });
    flushSync();
    harness.setForm({ s: 'errorsAccountPasskeyDeleteSuccess' });
    flushSync();
    expect(success).toHaveBeenCalledTimes(1);
    expect(success).toHaveBeenCalledWith(resolveMessageKey('errorsAccountPasskeyDeleteSuccess'));
    expect(error).not.toHaveBeenCalled();
  });

  it('resolves the error key through paraglide and toasts it', () => {
    harness = mountFormToasts({ errorKey: 'e' });
    flushSync();
    harness.setForm({ e: 'errorsAccountPasskeyAuthFailed' });
    flushSync();
    expect(error).toHaveBeenCalledTimes(1);
    expect(error).toHaveBeenCalledWith(resolveMessageKey('errorsAccountPasskeyAuthFailed'));
    expect(success).not.toHaveBeenCalled();
  });

  it('does not re-toast when the effect reruns with the same form object', () => {
    harness = mountFormToasts({ successKey: 's' });
    flushSync();
    harness.setForm({ s: 'errorsAccountPasskeyDeleteSuccess' });
    flushSync();
    harness.bump();
    flushSync();
    expect(success).toHaveBeenCalledTimes(1);
  });

  it('toasts again for a new form object (next submission)', () => {
    harness = mountFormToasts({ successKey: 's' });
    flushSync();
    harness.setForm({ s: 'errorsAccountPasskeyDeleteSuccess' });
    flushSync();
    harness.setForm({ s: 'errorsAccountPasskeyRenameSuccess' });
    flushSync();
    expect(success).toHaveBeenCalledTimes(2);
    expect(success).toHaveBeenLastCalledWith(
      resolveMessageKey('errorsAccountPasskeyRenameSuccess')
    );
  });

  it('ignores form objects that carry neither configured key', () => {
    harness = mountFormToasts({ successKey: 's', errorKey: 'e' });
    flushSync();
    harness.setForm({ unrelated: true });
    flushSync();
    expect(success).not.toHaveBeenCalled();
    expect(error).not.toHaveBeenCalled();
  });

  it('ignores keys that are not configured (success-only page)', () => {
    harness = mountFormToasts({ errorKey: 'e' });
    flushSync();
    harness.setForm({ s: 'errorsAccountPasskeyDeleteSuccess' });
    flushSync();
    expect(success).not.toHaveBeenCalled();
  });
});
