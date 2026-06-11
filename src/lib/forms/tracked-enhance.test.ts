import { describe, expect, it, mock } from 'bun:test';
import { trackSubmission, resolveMessageKey } from './tracked-enhance';

const noCancel = { cancel: () => {} };

describe('trackSubmission', () => {
  it('flips the setter true on submit and false after update resolves', async () => {
    const setter = mock();
    const onSubmit = trackSubmission(setter);
    const after = onSubmit(noCancel);
    expect(setter).toHaveBeenLastCalledWith(true);
    const update = mock(() => Promise.resolve());
    await after!({ result: { type: 'success' }, update });
    expect(update).toHaveBeenCalledOnce();
    expect(setter).toHaveBeenLastCalledWith(false);
    expect(setter).toHaveBeenCalledTimes(2);
  });

  it('resets the setter even when update throws', async () => {
    const setter = mock();
    const after = trackSubmission(setter)(noCancel);
    const update = mock(() => Promise.reject(new Error('aborted navigation')));
    await expect(after!({ result: { type: 'redirect' }, update })).rejects.toThrow(
      'aborted navigation'
    );
    expect(setter).toHaveBeenLastCalledWith(false);
  });

  it('cancels the submission when beforeSubmit returns false', () => {
    const setter = mock();
    const cancel = mock();
    const out = trackSubmission(setter, { beforeSubmit: () => false })({ cancel });
    expect(cancel).toHaveBeenCalledOnce();
    expect(setter).not.toHaveBeenCalled();
    expect(out).toBeUndefined();
  });

  it('runs onSuccess BEFORE update applies a success result', async () => {
    const order: string[] = [];
    const after = trackSubmission(() => {}, {
      onSuccess: () => order.push('onSuccess'),
      onFailure: () => order.push('onFailure')
    })(noCancel);
    await after!({
      result: { type: 'success' },
      update: async () => {
        order.push('update');
      }
    });
    expect(order).toEqual(['onSuccess', 'update']);
  });

  it('runs onFailure after a failure result is applied, and passes reset:false through', async () => {
    const order: string[] = [];
    let updateArg: { reset?: boolean } | undefined;
    const after = trackSubmission(() => {}, {
      reset: false,
      onSuccess: () => order.push('onSuccess'),
      onFailure: () => order.push('onFailure')
    })(noCancel);
    await after!({
      result: { type: 'failure' },
      update: async (o?: { reset?: boolean }) => {
        updateArg = o;
        order.push('update');
      }
    });
    expect(order).toEqual(['update', 'onFailure']);
    expect(updateArg).toEqual({ reset: false });
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
