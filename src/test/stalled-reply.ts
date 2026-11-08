// Server replies that never finish on their own, as a half-open mobile
// connection or a proxy that never answers leaves fetch: they end only once
// the request's signal aborts, with its reason, as fetch's do. For the
// deadline tests of the queue's replay and of the online submit (#496, #577).

/** Rejects with the signal's reason once it aborts, as fetch does, and never resolves. */
export const untilAborted = (signal: AbortSignal) =>
  new Promise<never>((_, reject) => {
    signal.addEventListener('abort', () => reject(signal.reason), { once: true });
  });

/** Headers at once, then a body that errors only once the signal aborts, as fetch's does. */
export const stalledBody = async (signal: AbortSignal) =>
  new Response(
    new ReadableStream({
      start(body) {
        signal.addEventListener('abort', () => body.error(signal.reason), { once: true });
      }
    }),
    { status: 200, headers: { 'content-type': 'application/json' } }
  );
