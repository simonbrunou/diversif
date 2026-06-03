// Small shims so the test suite can leave the codemod's mechanical
// replacements as-is. These map vitest-only utilities (stubGlobal,
// unstubAllGlobals, waitFor, advanceTimersByTimeAsync) onto bun:test
// primitives.

import { setSystemTime } from 'bun:test';

// stubGlobal / unstubAllGlobals: vitest tracks an internal stack of
// originals and restores them on call. We do the same.
const stubbedOriginals = new Map<string, unknown>();
const stubbedKeys = new Set<string>();

export function stubGlobal(name: string, value: unknown): void {
  // Capture the original ONCE so repeat stubs in the same test don't lose
  // it across overwrites.
  if (!stubbedKeys.has(name)) {
    stubbedKeys.add(name);
    stubbedOriginals.set(name, (globalThis as Record<string, unknown>)[name]);
  }
  // happy-dom's GlobalRegistrator installs `window`, `document`,
  // `localStorage`, etc. as non-writable properties on globalThis. Plain
  // assignment throws under strict mode. defineProperty with
  // configurable:true lets us round-trip through unstubAllGlobals.
  //
  // Also stub on `window` (which happy-dom mirrors with globalThis): some
  // code reads `window.localStorage` instead of bare `localStorage`, and if
  // we only patched globalThis the window-prefixed read would still see
  // happy-dom's original. Try/catch the window stub because not every name
  // exists on window (e.g. internal-only test stubs).
  Object.defineProperty(globalThis, name, {
    value,
    writable: true,
    configurable: true,
    enumerable: true
  });
  try {
    const w = (globalThis as Record<string, unknown>).window as Record<string, unknown> | undefined;
    if (w && typeof w === 'object') {
      Object.defineProperty(w, name, {
        value,
        writable: true,
        configurable: true,
        enumerable: true
      });
    }
  } catch {
    // window may not exist or property may be locked — ignored.
  }
}

export function unstubAllGlobals(): void {
  for (const name of stubbedKeys) {
    const orig = stubbedOriginals.get(name);
    if (orig === undefined) {
      delete (globalThis as Record<string, unknown>)[name];
      try {
        const w = (globalThis as Record<string, unknown>).window as
          | Record<string, unknown>
          | undefined;
        if (w) delete w[name];
      } catch {
        // ignored
      }
    } else {
      Object.defineProperty(globalThis, name, {
        value: orig,
        writable: true,
        configurable: true,
        enumerable: true
      });
      try {
        const w = (globalThis as Record<string, unknown>).window as
          | Record<string, unknown>
          | undefined;
        if (w && typeof w === 'object') {
          Object.defineProperty(w, name, {
            value: orig,
            writable: true,
            configurable: true,
            enumerable: true
          });
        }
      } catch {
        // ignored
      }
    }
  }
  stubbedKeys.clear();
  stubbedOriginals.clear();
}

// Poll a predicate until it returns a truthy value or the timeout elapses.
// Mirrors vitest's vi.waitFor — meant for "eventually consistent" assertions
// where the work happens off the awaited promise (e.g. a SIGTERM handler
// finishing on the next microtask tick).
export async function waitFor<T>(
  fn: () => T | Promise<T>,
  opts: { timeout?: number; interval?: number } = {}
): Promise<T> {
  const timeout = opts.timeout ?? 1000;
  const interval = opts.interval ?? 10;
  const deadline = Date.now() + timeout;
  let lastErr: unknown;
  while (Date.now() < deadline) {
    try {
      const result = await fn();
      if (result || result === undefined || result === null) return result;
    } catch (err) {
      lastErr = err;
    }
    await new Promise((r) => setTimeout(r, interval));
  }
  if (lastErr) throw lastErr;
  throw new Error(`waitFor: timeout after ${timeout}ms`);
}

// Bun has no built-in fake-timer advance. We combine setSystemTime with a
// microtask flush so anything keyed to Date.now() sees the new time and any
// queued setTimeouts/promises drain.
//
// Note: this is NOT equivalent to vitest's `advanceTimersByTimeAsync` for
// setInterval/setTimeout callbacks scheduled DURING fake-time. Bun's runtime
// uses the wall clock for setTimeout — it doesn't honour the faked Date for
// timer firing. Tests that depended on advancing a real setInterval through
// virtual time will need re-architecting (the cleanup-timer test, the
// rate-limit eviction test). For tests that only need Date.now() to read
// the advanced value, this is correct.
export async function advanceTimersByTimeAsync(ms: number): Promise<void> {
  setSystemTime(new Date(Date.now() + ms));
  // Two flushes: queued microtasks then any pending Promise chains.
  await new Promise((r) => setTimeout(r, 0));
  await new Promise((r) => setTimeout(r, 0));
}
