import { beforeEach, describe, expect, it, mock, setSystemTime, spyOn } from 'bun:test';
import { EventEmitter } from 'node:events';
import { advanceTimersByTimeAsync, waitFor } from '../../test/bun-test-utils';
import { drainPool, registerShutdownHandlers, _resetShutdownState } from './shutdown';

beforeEach(() => {
  _resetShutdownState();
});

describe('drainPool', () => {
  it('resolves "drained" when pool.end() resolves before the timeout', async () => {
    const pool = { end: mock().mockResolvedValue(undefined) };
    expect(await drainPool(pool, 1000)).toBe('drained');
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('resolves "error" when pool.end() rejects (so unhandledRejection doesn\'t kill the flush)', async () => {
    const pool = { end: mock().mockRejectedValue(new Error('half-closed')) };
    expect(await drainPool(pool, 1000)).toBe('error');
  });

  it('resolves "timeout" when pool.end() outlasts the budget', async () => {
    setSystemTime(new Date()); /* [bun-test] was useFakeTimers() */
    try {
      const pool = { end: mock(() => new Promise<void>(() => {})) };
      const promise = drainPool(pool, 100);
      await advanceTimersByTimeAsync(150);
      expect(await promise).toBe('timeout');
    } finally {
      setSystemTime(null);
    }
  });
});

describe('registerShutdownHandlers', () => {
  function makeProc() {
    const proc = new EventEmitter();
    return proc as EventEmitter & NodeJS.EventEmitter;
  }

  function makeHarness(overrides: Partial<Parameters<typeof registerShutdownHandlers>[0]> = {}) {
    const proc = makeProc();
    const pool = { end: mock().mockResolvedValue(undefined) };
    const exit = mock();
    const log = mock();
    registerShutdownHandlers({
      pool,
      process: proc,
      exit,
      log,
      timeoutMs: 1000,
      ...overrides
    });
    return { proc, pool, exit, log };
  }

  it('drains the pool and exits 0 on SIGTERM', async () => {
    const { proc, pool, exit, log } = makeHarness();
    proc.emit('SIGTERM');
    await waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({ type: 'shutdown.start', signal: 'SIGTERM' });
    expect(log).toHaveBeenCalledWith({ type: 'shutdown.complete', drain: 'drained' });
  });

  it('drains the pool and exits 0 on SIGINT', async () => {
    const { proc, pool, exit } = makeHarness();
    proc.emit('SIGINT');
    await waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('runs beforeExit before draining the pool', async () => {
    const order: string[] = [];
    const beforeExit = mock(async () => {
      order.push('beforeExit');
    });
    const pool = {
      end: mock(async () => {
        order.push('drain');
      })
    };
    const proc = makeProc();
    registerShutdownHandlers({
      pool,
      process: proc,
      exit: mock(),
      log: mock(),
      beforeExit,
      timeoutMs: 1000
    });
    proc.emit('SIGTERM');
    await waitFor(() => expect(pool.end).toHaveBeenCalled());
    expect(order).toEqual(['beforeExit', 'drain']);
  });

  it('logs and swallows beforeExit failures so the pool drain still runs', async () => {
    const beforeExit = mock(async () => {
      throw new Error('cleanup blew up');
    });
    const { proc, pool, exit, log } = makeHarness({ beforeExit });
    proc.emit('SIGTERM');
    await waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({
      type: 'shutdown.beforeExitFailed',
      error: 'Error: cleanup blew up'
    });
  });

  it('runs flush after draining the pool, before exit', async () => {
    const order: string[] = [];
    const pool = {
      end: mock(async () => {
        order.push('drain');
      })
    };
    const flush = mock(async () => {
      order.push('flush');
    });
    const exit = mock(() => {
      order.push('exit');
    });
    const proc = makeProc();
    registerShutdownHandlers({
      pool,
      process: proc,
      exit,
      log: mock(),
      flush,
      timeoutMs: 1000
    });
    proc.emit('SIGTERM');
    await waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(order).toEqual(['drain', 'flush', 'exit']);
    expect(flush).toHaveBeenCalledTimes(1);
  });

  it('logs and swallows flush failures so shutdown still completes', async () => {
    const flush = mock(async () => {
      throw new Error('flush blew up');
    });
    const { proc, exit, log } = makeHarness({ flush });
    proc.emit('SIGTERM');
    await waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(log).toHaveBeenCalledWith({
      type: 'shutdown.flushFailed',
      error: 'Error: flush blew up'
    });
  });

  it('is idempotent across re-registration', async () => {
    const { proc, pool, exit } = makeHarness();
    // A second register call must not stack listeners : otherwise SIGTERM
    // would trigger two pool drains and two exit calls under shared state.
    registerShutdownHandlers({
      pool: { end: mock() },
      process: proc,
      exit: mock(),
      log: mock(),
      timeoutMs: 1000
    });
    proc.emit('SIGTERM');
    await waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('ignores a second signal once a shutdown is already in flight', async () => {
    let releaseDrain: () => void = () => {};
    const pool = {
      end: mock(
        () =>
          new Promise<void>((resolve) => {
            releaseDrain = resolve;
          })
      )
    };
    const proc = makeProc();
    const exit = mock();
    registerShutdownHandlers({ pool, process: proc, exit, log: mock(), timeoutMs: 1000 });
    proc.emit('SIGTERM');
    proc.emit('SIGINT');
    // Allow the first handler to advance past its in-flight check before
    // the drain is released.
    await Promise.resolve();
    releaseDrain();
    await waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('defaults to process.on/process.exit/console.log/DEFAULT_TIMEOUT when overrides are omitted', async () => {
    const pool = { end: mock().mockResolvedValue(undefined) };
    const exitSpy = spyOn(process, 'exit').mockImplementation(((_code?: number) => {}) as never);
    const logSpy = spyOn(console, 'log').mockImplementation(() => {});
    // Snapshot listener counts so we can strip the ones we register, otherwise
    // every later test in this worker would inherit our SIGTERM handler.
    const sigtermBefore = process.listenerCount('SIGTERM');
    const sigintBefore = process.listenerCount('SIGINT');
    try {
      registerShutdownHandlers({ pool });
      process.emit('SIGTERM');
      await waitFor(() => expect(exitSpy).toHaveBeenCalledWith(0));
      expect(logSpy).toHaveBeenCalledWith(
        JSON.stringify({ type: 'shutdown.start', signal: 'SIGTERM' })
      );
      expect(pool.end).toHaveBeenCalledTimes(1);
    } finally {
      const sigtermExtra = process.listeners('SIGTERM').slice(sigtermBefore);
      const sigintExtra = process.listeners('SIGINT').slice(sigintBefore);
      sigtermExtra.forEach((l) => process.off('SIGTERM', l as (...args: unknown[]) => void));
      sigintExtra.forEach((l) => process.off('SIGINT', l as (...args: unknown[]) => void));
      exitSpy.mockRestore();
      logSpy.mockRestore();
    }
  });
});
