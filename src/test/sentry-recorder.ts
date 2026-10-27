import * as Sentry from '@sentry/sveltekit';
import type { BrowserOptions, Event } from '@sentry/sveltekit';

// Not `Parameters<typeof Sentry.init>[0]['transport']`: init takes a union of
// three option types, which gives a union of transport types and leaves the
// parameters below untyped. The browser and server SDKs both open the
// transport with the url and headers it records.
type Transport = NonNullable<BrowserOptions['transport']>;

/** The payload of each envelope item type these tests read, as it went on the wire. */
type Sent = {
  event: Event & { urls?: string[]; segment_names?: string[] };
  transaction: Event;
  feedback: Event;
  session: { attrs?: Record<string, string> };
  log: { items: { attributes: Record<string, { value: unknown }> }[] };
};

/**
 * The test adapter at the SDK's `transport` seam, next to the fetch transport
 * production uses: every envelope item the real SDK would send is recorded
 * instead, after every option and integration of the policy under test ran.
 */
export function recordingTransport() {
  const items: { type: string; payload: unknown }[] = [];
  const opened: { url?: string; headers?: Record<string, string> } = {};
  const transport: Transport = (options) => {
    opened.url = options.url;
    opened.headers = options.headers;
    return {
      send: async (envelope) => {
        for (const [header, payload] of envelope[1]) {
          // Serialised as the fetch transport would: what is undefined never leaves.
          items.push({ type: header.type, payload: JSON.parse(JSON.stringify(payload)) });
        }
        return { statusCode: 200 };
      },
      flush: async () => true
    };
  };

  return {
    transport,
    /** The URL and headers the SDK opened the transport with. */
    opened,
    /** Waits for the SDK to hand over what it captured so far, then returns the items of `type`. */
    async sent<T extends keyof Sent>(type: T): Promise<Sent[T][]> {
      await Sentry.flush(2000);
      return items.filter((item) => item.type === type).map((item) => item.payload as Sent[T]);
    },
    /** Waits for every pending send, then forgets everything recorded. */
    async reset(): Promise<void> {
      await Sentry.flush(2000);
      items.length = 0;
    }
  };
}
