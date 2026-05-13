import { describe, it, expect } from 'vitest';
import { scrubEvent, scrubPathname, filterIncomingBreadcrumb } from './sentry';

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
