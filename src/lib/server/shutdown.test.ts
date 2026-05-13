import { describe, it, expect, beforeEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';
import { drainPool, registerShutdownHandlers, _resetShutdownState } from './shutdown';

beforeEach(() => {
  _resetShutdownState();
});

describe('drainPool', () => {
  it('resolves "drained" when pool.end() resolves before the timeout', async () => {
    const pool = { end: vi.fn().mockResolvedValue(undefined) };
    expect(await drainPool(pool, 1000)).toBe('drained');
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('resolves "error" when pool.end() rejects (so unhandledRejection doesn\'t kill the flush)', async () => {
    const pool = { end: vi.fn().mockRejectedValue(new Error('half-closed')) };
    expect(await drainPool(pool, 1000)).toBe('error');
  });

  it('resolves "timeout" when pool.end() outlasts the budget', async () => {
    vi.useFakeTimers();
    try {
      const pool = { end: vi.fn(() => new Promise<void>(() => {})) };
      const promise = drainPool(pool, 100);
      await vi.advanceTimersByTimeAsync(150);
      expect(await promise).toBe('timeout');
    } finally {
      vi.useRealTimers();
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
    const pool = { end: vi.fn().mockResolvedValue(undefined) };
    const exit = vi.fn();
    const log = vi.fn();
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
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({ type: 'shutdown.start', signal: 'SIGTERM' });
    expect(log).toHaveBeenCalledWith({ type: 'shutdown.complete', drain: 'drained' });
  });

  it('drains the pool and exits 0 on SIGINT', async () => {
    const { proc, pool, exit } = makeHarness();
    proc.emit('SIGINT');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('runs beforeExit before draining the pool', async () => {
    const order: string[] = [];
    const beforeExit = vi.fn(async () => {
      order.push('beforeExit');
    });
    const pool = {
      end: vi.fn(async () => {
        order.push('drain');
      })
    };
    const proc = makeProc();
    registerShutdownHandlers({
      pool,
      process: proc,
      exit: vi.fn(),
      log: vi.fn(),
      beforeExit,
      timeoutMs: 1000
    });
    proc.emit('SIGTERM');
    await vi.waitFor(() => expect(pool.end).toHaveBeenCalled());
    expect(order).toEqual(['beforeExit', 'drain']);
  });

  it('logs and swallows beforeExit failures so the pool drain still runs', async () => {
    const beforeExit = vi.fn(async () => {
      throw new Error('cleanup blew up');
    });
    const { proc, pool, exit, log } = makeHarness({ beforeExit });
    proc.emit('SIGTERM');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(log).toHaveBeenCalledWith({
      type: 'shutdown.beforeExitFailed',
      error: 'Error: cleanup blew up'
    });
  });

  it('is idempotent across re-registration', async () => {
    const { proc, pool, exit } = makeHarness();
    // A second register call must not stack listeners : otherwise SIGTERM
    // would trigger two pool drains and two exit calls under shared state.
    registerShutdownHandlers({
      pool: { end: vi.fn() },
      process: proc,
      exit: vi.fn(),
      log: vi.fn(),
      timeoutMs: 1000
    });
    proc.emit('SIGTERM');
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(pool.end).toHaveBeenCalledTimes(1);
  });

  it('ignores a second signal once a shutdown is already in flight', async () => {
    let releaseDrain: () => void = () => {};
    const pool = {
      end: vi.fn(
        () =>
          new Promise<void>((resolve) => {
            releaseDrain = resolve;
          })
      )
    };
    const proc = makeProc();
    const exit = vi.fn();
    registerShutdownHandlers({ pool, process: proc, exit, log: vi.fn(), timeoutMs: 1000 });
    proc.emit('SIGTERM');
    proc.emit('SIGINT');
    // Allow the first handler to advance past its in-flight check before
    // the drain is released.
    await Promise.resolve();
    releaseDrain();
    await vi.waitFor(() => expect(exit).toHaveBeenCalledWith(0));
    expect(pool.end).toHaveBeenCalledTimes(1);
    expect(exit).toHaveBeenCalledTimes(1);
  });

  it('defaults to process.on/process.exit/console.log/DEFAULT_TIMEOUT when overrides are omitted', async () => {
    const pool = { end: vi.fn().mockResolvedValue(undefined) };
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((_code?: number) => {}) as never);
    const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    // Snapshot listener counts so we can strip the ones we register, otherwise
    // every later test in this worker would inherit our SIGTERM handler.
    const sigtermBefore = process.listenerCount('SIGTERM');
    const sigintBefore = process.listenerCount('SIGINT');
    try {
      registerShutdownHandlers({ pool });
      process.emit('SIGTERM');
      await vi.waitFor(() => expect(exitSpy).toHaveBeenCalledWith(0));
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
