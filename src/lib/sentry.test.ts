import { describe, expect, it } from 'bun:test';
import {
  scrubEvent,
  scrubPathname,
  filterIncomingBreadcrumb,
  scrubSpan,
  scrubLog,
  scrubRecordingEvent,
  scrubRecordingFrames,
  parseSampleRate,
  isNetworkFailure,
  clientRouteTag
} from './sentry';

describe('scrubPathname', () => {
  it('returns the route pattern verbatim when given one', () => {
    expect(scrubPathname('/child/42/log/9', '/child/[id]/log/[entryId]')).toBe(
      '/child/[id]/log/[entryId]'
    );
  });

  it('replaces purely numeric segments in the fallback path', () => {
    expect(scrubPathname('/child/2/guide')).toBe('/child/[id]/guide');
  });

  it('replaces long token-like segments in the fallback path', () => {
    expect(scrubPathname('/passkeys/auth/abc123def-9876xyz/verify')).toBe(
      '/passkeys/auth/[id]/verify'
    );
  });

  it('keeps short alphabetic segments untouched', () => {
    expect(scrubPathname('/account/export')).toBe('/account/export');
  });

  it('handles trailing and leading slashes', () => {
    expect(scrubPathname('/')).toBe('/');
    expect(scrubPathname('')).toBe('/');
  });
});

describe('scrubEvent', () => {
  function baseEvent() {
    return {
      tags: { errorId: 'abcd1234', route: '/child/[id]/log/[entryId]' },
      request: {
        url: 'https://diversif.app/child/42/log/9?cid=secret',
        data: { foo: 'bar' },
        query_string: 'cid=secret&foo=bar',
        cookies: 'session=...',
        headers: { authorization: 'Bearer x' }
      },
      user: { id: '7', email: 'a@example.com', ip_address: '1.2.3.4' },
      breadcrumbs: [
        { category: 'navigation', data: { from: '/child/42', to: '/child/42/log/9' } },
        { category: 'ui.click', message: 'click on .submit-button' },
        { category: 'ui.input', message: 'type in #email' },
        { category: 'console', message: 'hi', level: 'log' }
      ]
    };
  }

  it('rewrites the request URL using the route tag', () => {
    const e = baseEvent();
    const out = scrubEvent(e);
    expect(out).not.toBeNull();
    expect(out!.request!.url).toBe('https://diversif.app/child/[id]/log/[entryId]');
  });

  it('drops query strings even when route tag is missing', () => {
    const e = baseEvent();
    delete e.tags.route;
    e.request.url = 'https://diversif.app/foo?cid=abc';
    const out = scrubEvent(e)!;
    expect(out.request!.url).toBe('https://diversif.app/foo');
  });

  it('drops request.data, request.cookies, request.headers, request.query_string', () => {
    const out = scrubEvent(baseEvent())!;
    expect(out.request!.data).toBeUndefined();
    expect(out.request!.cookies).toBeUndefined();
    expect(out.request!.headers).toBeUndefined();
    expect(out.request!.query_string).toBeUndefined();
  });

  it('strips user context entirely', () => {
    const out = scrubEvent(baseEvent())!;
    expect(out.user).toBeUndefined();
  });

  it('drops ui.click, ui.input, and console breadcrumbs but keeps navigation', () => {
    const out = scrubEvent(baseEvent())!;
    const cats = out.breadcrumbs!.map((b) => b.category);
    expect(cats).toEqual(['navigation']);
  });

  it('scrubs URLs inside navigation breadcrumb data', () => {
    const out = scrubEvent(baseEvent())!;
    const nav = out.breadcrumbs!.find((b) => b.category === 'navigation')!;
    expect(nav.data).toEqual({ from: '/child/[id]', to: '/child/[id]/log/[id]' });
  });

  it('preserves tags untouched', () => {
    const out = scrubEvent(baseEvent())!;
    expect(out.tags).toEqual({ errorId: 'abcd1234', route: '/child/[id]/log/[entryId]' });
  });

  it('returns null on a malformed input rather than throwing', () => {
    // @ts-expect-error deliberately broken
    expect(scrubEvent(null)).toBeNull();
    // Malformed URL : scrubEvent must not throw; it returns the mutated event.
    expect(() => scrubEvent({ request: { url: 'not a url' } })).not.toThrow();
  });

  it('handles events without request, user, or breadcrumbs', () => {
    const out = scrubEvent({ tags: { errorId: 'x' } })!;
    expect(out.tags).toEqual({ errorId: 'x' });
  });

  it('uses event.transaction as route fallback when tags.route is absent', () => {
    const e = {
      transaction: '/child/[id]/log/[entryId]',
      request: { url: 'https://diversif.app/child/99/log/1?q=secret' }
    };
    const out = scrubEvent(e)!;
    expect(out.request!.url).toBe('https://diversif.app/child/[id]/log/[entryId]');
  });

  it('passes through breadcrumbs with no data field unchanged', () => {
    const e = {
      breadcrumbs: [{ category: 'navigation', message: 'some nav' }]
    };
    const out = scrubEvent(e)!;
    expect(out.breadcrumbs![0]).toEqual({ category: 'navigation', message: 'some nav' });
  });

  it('scrubs breadcrumb data keys other than url/from/to left as-is', () => {
    const e = {
      breadcrumbs: [
        {
          category: 'navigation',
          data: { from: '/child/42', to: '/child/42/log/9', extra: 'keep' }
        }
      ]
    };
    const out = scrubEvent(e)!;
    expect(out.breadcrumbs![0].data).toEqual({
      from: '/child/[id]',
      to: '/child/[id]/log/[id]',
      extra: 'keep'
    });
  });

  it('returns null when internal processing throws unexpectedly', () => {
    // Construct an event whose property access throws inside the try block.
    const boom = Object.create(null, {
      request: {
        get() {
          throw new Error('internal boom');
        },
        enumerable: true
      }
    });
    // The guard passes (boom is a non-null object), then accessing boom.request throws.
    expect(scrubEvent(boom as never)).toBeNull();
  });

  it('redacts top-level event.message', () => {
    const e = {
      tags: { errorId: 'abc' },
      message: 'User a@example.com had invalid input'
    };
    const out = scrubEvent(e)!;
    expect(out.message).toBe('[redacted: see errorId in stderr]');
  });

  it('redacts each exception.values[].value', () => {
    const e = {
      tags: { errorId: 'abc' },
      exception: {
        values: [
          { type: 'TypeError', value: 'User a@example.com invalid' },
          { type: 'Error', value: 'child Sophie failed lookup' }
        ]
      }
    };
    const out = scrubEvent(e)!;
    expect(out.exception!.values![0].value).toBe('[redacted: see errorId in stderr]');
    expect(out.exception!.values![1].value).toBe('[redacted: see errorId in stderr]');
    // type is preserved
    expect(out.exception!.values![0].type).toBe('TypeError');
  });

  it('drops stack frame vars (which may capture local PII)', () => {
    const e = {
      tags: { errorId: 'abc' },
      exception: {
        values: [
          {
            type: 'TypeError',
            stacktrace: {
              frames: [
                {
                  function: 'load',
                  filename: 'src/routes/+page.server.ts',
                  lineno: 42,
                  vars: { user: { email: 'a@example.com' }, secret: 'xyz' }
                }
              ]
            }
          }
        ]
      }
    };
    const out = scrubEvent(e)!;
    const frame = out.exception!.values![0].stacktrace!.frames![0];
    expect(frame.vars).toBeUndefined();
    // Other frame fields are preserved
    expect(frame.function).toBe('load');
    expect(frame.filename).toBe('src/routes/+page.server.ts');
    expect(frame.lineno).toBe(42);
  });

  it('handles events with no exception field', () => {
    const out = scrubEvent({ tags: { errorId: 'abc' } })!;
    expect(out.tags).toEqual({ errorId: 'abc' });
  });

  it('handles exception with no values array', () => {
    const out = scrubEvent({ tags: { errorId: 'abc' }, exception: {} })!;
    expect(out.exception).toEqual({});
  });

  it('handles exception value with no stacktrace', () => {
    const e = {
      tags: { errorId: 'abc' },
      exception: { values: [{ type: 'TypeError', value: 'msg' }] }
    };
    const out = scrubEvent(e)!;
    expect(out.exception!.values![0].value).toBe('[redacted: see errorId in stderr]');
  });

  it('scrubs a raw-pathname transaction and does not trust it as a route pattern', () => {
    // Browser errors outside handleError carry the raw location as their
    // transaction; copying it into request.url verbatim leaked child ids.
    const out = scrubEvent({
      transaction: '/child/18/guide',
      request: { url: 'https://diversif.app/child/18/guide?tab=2' }
    })!;
    expect(out.transaction).toBe('/child/[id]/guide');
    expect(out.request!.url).toBe('https://diversif.app/child/[id]/guide');
  });

  it('uses a method-prefixed server transaction as the route pattern', () => {
    const out = scrubEvent({
      transaction: 'GET /child/[id]/log',
      request: { url: 'https://diversif.app/child/7/log#top' }
    })!;
    expect(out.transaction).toBe('GET /child/[id]/log');
    expect(out.request!.url).toBe('https://diversif.app/child/[id]/log');
  });

  it('drops client identifiers and query attributes from a transaction trace and its spans', () => {
    const out = scrubEvent({
      type: 'transaction',
      transaction: 'GET /child/[id]/foods',
      contexts: {
        trace: {
          data: {
            'url.full': 'https://diversif.app/child/18/foods?cat=fruits',
            'url.query': 'cat=fruits',
            'http.route': '/child/[id]/foods',
            'http.request.header.cf_connecting_ip': '203.0.113.9',
            'http.request.header.referer': 'https://diversif.app/child/18',
            'user_agent.original': 'Mozilla/5.0',
            'client.address': '203.0.113.9',
            'sentry.op': 'http.server'
          }
        }
      },
      spans: [
        {
          description: 'GET /child/18/foods?cat=fruits',
          data: { url: '/child/18/foods', 'http.query': '?cat=fruits' }
        }
      ]
    })!;
    expect(out.contexts!.trace!.data).toEqual({
      'url.full': 'https://diversif.app/child/[id]/foods',
      'http.route': '/child/[id]/foods',
      'sentry.op': 'http.server'
    });
    expect(out.spans![0]).toEqual({
      description: 'GET /child/[id]/foods',
      data: { url: '/child/[id]/foods' }
    });
  });

  it('keeps a feedback message but scrubs its page URL and contact fields', () => {
    const out = scrubEvent({
      type: 'feedback',
      contexts: {
        feedback: {
          message: 'Le bouton ne répond pas',
          url: 'https://diversif.app/child/18/log?date=2026-09-01',
          contact_email: 'parent@example.com',
          name: 'Camille'
        }
      }
    })!;
    expect(out.contexts!.feedback).toEqual({
      message: 'Le bouton ne répond pas',
      url: 'https://diversif.app/child/[id]/log'
    });
  });

  it('scrubs the visited URLs and segment names of a replay event', () => {
    const out = scrubEvent({
      type: 'replay_event',
      urls: ['https://diversif.app/child/18', '/child/18/foods/42?x=1', 7],
      segment_names: ['/child/18', 'pageload']
    })!;
    expect(out.urls).toEqual(['https://diversif.app/child/[id]', '/child/[id]/foods/[id]', 7]);
    expect(out.segment_names).toEqual(['/child/[id]', 'pageload']);
  });
});

describe('scrubSpan', () => {
  it('leaves non-URL span names and attributes untouched', () => {
    const span = { description: 'sveltekit.load', data: { 'sveltekit.load.node_type': 'page' } };
    expect(scrubSpan(span)).toEqual({
      description: 'sveltekit.load',
      data: { 'sveltekit.load.node_type': 'page' }
    });
  });

  it('scrubs an absolute fetch URL in the span name', () => {
    expect(scrubSpan({ description: 'POST https://diversif.app/child/18/log?/save' })).toEqual({
      description: 'POST https://diversif.app/child/[id]/log'
    });
  });

  it('strips attribute values from the element named by an interaction span', () => {
    // INP spans are named by the SDK's htmlTreeAsString, which appends
    // aria-label/title/alt/name values — here a child's first name.
    const span = {
      op: 'ui.interaction.click',
      description:
        'div.grid > a.flex.items-center#row-3[aria-label="Ouvrir les réglages de Léo"][title="Léo"]'
    };
    expect(scrubSpan(span).description).toBe('div.grid > a.flex.items-center#row-3');
  });

  it('strips attribute values that contain unescaped quotes, keeping Tailwind classes', () => {
    // htmlTreeAsString doesn't escape values; custom food names are free text.
    const span = {
      op: 'ui.interaction.click',
      description:
        'li.w-[88px] > button.pill[aria-label="Retirer Purée "maison" de la sélection"][type="button"]'
    };
    expect(scrubSpan(span).description).toBe('li.w-[88px] > button.pill');
  });

  it('reads the op from span data for web-vital spans', () => {
    const span = {
      description: 'button.pill[aria-label="Retirer Poisson de la sélection"]',
      data: { 'sentry.op': 'ui.webvital.cls' }
    };
    expect(scrubSpan(span).description).toBe('button.pill');
  });

  it('strips attribute values from LCP and CLS element attributes', () => {
    const span = {
      description: '/child/18',
      data: {
        'lcp.element': 'img.photo[alt="Léo au parc"]',
        'browser.web_vital.cls.source.1': 'li.meal[aria-label="Voir le repas concerné : arachide"]',
        'lcp.url': 'https://diversif.app/child/18/photo.jpg?v=2'
      }
    };
    expect(scrubSpan(span).data).toEqual({
      'lcp.element': 'img.photo',
      'browser.web_vital.cls.source.1': 'li.meal',
      'lcp.url': 'https://diversif.app/child/[id]/photo.jpg'
    });
  });
});

describe('scrubLog', () => {
  it('drops user attributes and scrubs URL attributes', () => {
    const log = {
      message: 'cleanup completed',
      attributes: { 'user.email': 'a@example.com', 'url.path': '/child/18', expiredSessions: 3 }
    };
    expect(scrubLog(log).attributes).toEqual({ 'url.path': '/child/[id]', expiredSessions: 3 });
  });

  it('accepts logs without attributes', () => {
    expect(scrubLog({})).toEqual({});
  });
});

describe('parseSampleRate', () => {
  it('accepts rates within [0, 1] inclusive', () => {
    expect(parseSampleRate('0', 0.5)).toBe(0);
    expect(parseSampleRate('0.25', 0.5)).toBe(0.25);
    expect(parseSampleRate('1', 0.5)).toBe(1);
  });

  it('falls back on unset, blank, non-numeric, or out-of-range values', () => {
    for (const raw of [undefined, '', '  ', 'abc', '1.5', '-0.1', 'Infinity']) {
      expect(parseSampleRate(raw, 0.1)).toBe(0.1);
    }
  });
});

describe('scrubRecordingFrames', () => {
  it('scrubs the page URL of rrweb meta frames and leaves other frames alone', () => {
    const snapshot = { type: 2, data: { node: { id: 1 } } };
    const frames = [
      { type: 4, data: { href: 'https://diversif.app/child/18?welcome=1', width: 1280 } },
      snapshot,
      { type: 4 },
      'not-a-frame'
    ];
    scrubRecordingFrames(frames);
    expect(frames).toEqual([
      { type: 4, data: { href: 'https://diversif.app/child/[id]', width: 1280 } },
      { type: 2, data: { node: { id: 1 } } },
      { type: 4 },
      'not-a-frame'
    ]);
  });

  it('scrubs link URLs in snapshot nodes and mutation records, keeping other attributes', () => {
    const frames = [
      {
        type: 2,
        data: {
          node: {
            id: 1,
            childNodes: [
              {
                id: 2,
                tagName: 'a',
                attributes: {
                  href: 'https://diversif.app/child/18/foods?segment=allergens',
                  class: 'pill',
                  'aria-label': '****'
                },
                childNodes: []
              }
            ]
          }
        }
      },
      {
        type: 3,
        data: {
          source: 0,
          adds: [{ parentId: 1, node: { id: 3, attributes: { src: '/child/18/photo.jpg?v=2' } } }],
          attributes: [{ id: 2, attributes: { href: '/child/18/log#top', title: null } }]
        }
      }
    ];
    scrubRecordingFrames(frames);
    expect(frames[0].data.node!.childNodes![0].attributes).toEqual({
      href: 'https://diversif.app/child/[id]/foods',
      class: 'pill',
      'aria-label': '****'
    });
    expect(frames[1].data.adds![0].node.attributes).toEqual({ src: '/child/[id]/photo.jpg' });
    expect(frames[1].data.attributes![0].attributes).toEqual({
      href: '/child/[id]/log',
      title: null
    });
  });

  it('ignores a recording that is not an event array', () => {
    const recording = { type: 4, data: { href: '/child/18' } };
    scrubRecordingFrames(recording);
    expect(recording.data.href).toBe('/child/18');
  });
});

describe('scrubRecordingEvent', () => {
  it('drops console breadcrumb frames', () => {
    const frame = {
      data: { tag: 'breadcrumb', payload: { category: 'console', message: 'secret' } }
    };
    expect(scrubRecordingEvent(frame)).toBeNull();
  });

  it('strips the selector and node details of ui.* breadcrumb frames', () => {
    const out = scrubRecordingEvent({
      data: {
        tag: 'breadcrumb',
        payload: {
          category: 'ui.click',
          message: 'a.pill[aria-label="Poisson"]',
          data: {
            nodeId: 12,
            url: 'https://diversif.app/child/18',
            node: { id: 12, tagName: 'a', textContent: 'Poisson', attributes: { href: '/x' } }
          }
        }
      }
    });
    expect(out!.data!.payload).toEqual({
      category: 'ui.click',
      data: { nodeId: 12, url: 'https://diversif.app/child/[id]', node: { id: 12, tagName: 'a' } }
    });
  });

  it('scrubs URLs in navigation breadcrumb frames', () => {
    const out = scrubRecordingEvent({
      data: {
        tag: 'breadcrumb',
        payload: { category: 'navigation', data: { from: '/child/18', to: '/child/18/log' } }
      }
    });
    expect(out!.data!.payload!.data).toEqual({ from: '/child/[id]', to: '/child/[id]/log' });
  });

  it('scrubs the URL named by performanceSpan frames', () => {
    const out = scrubRecordingEvent({
      data: {
        tag: 'performanceSpan',
        payload: { op: 'navigation.navigate', description: 'https://diversif.app/child/18?x=1' }
      }
    });
    expect(out!.data!.payload!.description).toBe('https://diversif.app/child/[id]');
  });

  it('passes through frames without data or payload', () => {
    const bare = { type: 3 };
    expect(scrubRecordingEvent(bare)).toBe(bare);
    const noPayload = { type: 5, data: { tag: 'options' } };
    expect(scrubRecordingEvent(noPayload)).toBe(noPayload);
  });
});

describe('filterIncomingBreadcrumb', () => {
  it('drops ui.click breadcrumbs', () => {
    expect(filterIncomingBreadcrumb({ category: 'ui.click', message: 'click .x' })).toBeNull();
  });
  it('drops ui.input breadcrumbs', () => {
    expect(filterIncomingBreadcrumb({ category: 'ui.input', message: 'type #email' })).toBeNull();
  });
  it('drops console breadcrumbs (would leak [diversif:error] JSON)', () => {
    expect(
      filterIncomingBreadcrumb({ category: 'console', message: '[diversif:error] {"id":"x"}' })
    ).toBeNull();
  });
  it('keeps navigation breadcrumbs', () => {
    const b = { category: 'navigation', data: { from: '/a', to: '/b' } };
    expect(filterIncomingBreadcrumb(b)).toBe(b);
  });
  it('keeps breadcrumbs without a category', () => {
    const b = { message: 'no category here' };
    expect(filterIncomingBreadcrumb(b)).toBe(b);
  });
});

describe('isNetworkFailure', () => {
  it.each([
    'Failed to fetch',
    'Failed to fetch (diversif.app)',
    'network error',
    'Failed to fetch dynamically imported module: https://diversif.app/_app/immutable/nodes/19.x.js',
    'NetworkError when attempting to fetch resource.',
    'NetworkError when attempting to fetch resource. (diversif.app)',
    'error loading dynamically imported module: https://diversif.app/_app/immutable/nodes/19.x.js',
    'Load failed',
    'Load failed (diversif.app)',
    'The Internet connection appears to be offline.',
    'Importing a module script failed.'
  ])('recognises the browser TypeError %p', (message) => {
    expect(isNetworkFailure(new TypeError(message))).toBe(true);
  });

  it('reports TypeErrors raised by app code', () => {
    expect(
      isNetworkFailure(new TypeError("Cannot read properties of undefined (reading 'id')"))
    ).toBe(false);
    // Only the whole message counts: app code quoting a network error is a bug.
    expect(isNetworkFailure(new TypeError('Parsing failed: Failed to fetch'))).toBe(false);
  });

  it('reports a network-looking message that is not a TypeError', () => {
    expect(isNetworkFailure(new Error('Failed to fetch'))).toBe(false);
    expect(isNetworkFailure('Failed to fetch')).toBe(false);
    expect(isNetworkFailure(undefined)).toBe(false);
  });
});

describe('clientRouteTag', () => {
  it('keeps a dynamic route pattern verbatim', () => {
    expect(clientRouteTag('/child/[id]/guide', { id: '18' })).toBe('/child/[id]/guide');
  });

  it('keeps a static route id verbatim, even a long hyphenated one', () => {
    expect(clientRouteTag('/politique-confidentialite', {})).toBe('/politique-confidentialite');
  });

  it('scrubs the page key a failed __data.json fetch passes as route.id', () => {
    expect(clientRouteTag('/child/18/guide', { id: '18' })).toBe('/child/[id]/guide');
    expect(clientRouteTag('/join/abcd1234?ref=mail', { code: 'abcd1234' })).toBe('/join/[id]');
  });

  it('drops the query a static page key carries', () => {
    expect(clientRouteTag('/signup?code=ABCD1234', {})).toBe('/signup');
    expect(clientRouteTag('/login?next=/child/18', {})).toBe('/login');
  });

  it('returns null without a route id', () => {
    expect(clientRouteTag(null, {})).toBeNull();
    expect(clientRouteTag(undefined, { id: '1' })).toBeNull();
  });
});
