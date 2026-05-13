// Adapter-node closes the HTTP server on SIGTERM but leaves the pg pool
// holding open connections. Postgres then sees the client vanish and may
// log "unexpected EOF" or : worse : keep the backend alive long enough to
// affect a follow-up deploy (e.g. another instance hitting connection
// limits). Drain the pool ourselves before letting the process exit.

type EndablePool = { end: () => Promise<void> };

type Logger = (msg: object) => void;

type ShutdownOptions = {
  pool: EndablePool;
  // beforeExit runs first and is meant for in-process side jobs (cleanup
  // timer, idempotency-key purge); errors are logged and swallowed so a
  // broken cleanup never blocks the pool drain.
  beforeExit?: () => void | Promise<void>;
  // Caps the pool drain. pool.end() waits for in-flight queries : fine in
  // theory, but a stuck statement_timeout-defying query would hold the
  // process forever. 10s deliberately matches the pool's statement_timeout:
  // a query started just before SIGTERM may still be running when the
  // budget expires, in which case drainPool returns 'timeout' rather than
  // 'drained' and the process exits cleanly anyway.
  timeoutMs?: number;
  exit?: (code: number) => void;
  log?: Logger;
  process?: NodeJS.EventEmitter;
};

const DEFAULT_TIMEOUT_MS = 10_000;

let registered = false;
let inFlight = false;

export async function drainPool(
  pool: EndablePool,
  timeoutMs: number
): Promise<'drained' | 'timeout' | 'error'> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve('timeout'), timeoutMs);
    timer.unref?.();
    pool.end().then(
      () => {
        clearTimeout(timer);
        resolve('drained');
      },
      () => {
        // pool.end() shouldn't reject under normal use, but we don't want a
        // rejection from a half-closed pool to leak as an unhandledRejection
        // and prevent Sentry/audit from getting their final flush in.
        clearTimeout(timer);
        resolve('error');
      }
    );
  });
}

export function registerShutdownHandlers(opts: ShutdownOptions): void {
  if (registered) return;
  registered = true;
  const proc: NodeJS.EventEmitter = opts.process ?? process;
  const exit = opts.exit ?? ((code: number) => process.exit(code));
  const log: Logger = opts.log ?? ((msg) => console.log(JSON.stringify(msg)));
  const timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const handler = async (signal: string) => {
    if (inFlight) return;
    inFlight = true;
    log({ type: 'shutdown.start', signal });
    if (opts.beforeExit) {
      try {
        await opts.beforeExit();
      } catch (err) {
        log({ type: 'shutdown.beforeExitFailed', error: String(err) });
      }
    }
    const result = await drainPool(opts.pool, timeoutMs);
    log({ type: 'shutdown.complete', drain: result });
    exit(0);
  };

  proc.on('SIGTERM', () => {
    void handler('SIGTERM');
  });
  proc.on('SIGINT', () => {
    void handler('SIGINT');
  });
}

export function _resetShutdownState(): void {
  registered = false;
  inFlight = false;
}
