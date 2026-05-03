import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET } from './+server';
import { makeRouteEvent } from '../../test/route';

describe('GET /robots.txt', () => {
  const ORIGINAL = process.env.ORIGIN;
  beforeEach(() => {
    delete process.env.ORIGIN;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ORIGIN;
    else process.env.ORIGIN = ORIGINAL;
  });

  it('returns text/plain with the sitemap URL pinned to the request origin', async () => {
    const event = makeRouteEvent({ url: 'https://my.app/robots.txt' });
    const res = await GET(event as unknown as Parameters<typeof GET>[0]);
    expect(res.headers.get('content-type')).toContain('text/plain');
    const body = await res.text();
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Disallow: /child/');
    expect(body).toContain('Disallow: /account');
    expect(body).toContain('Sitemap: https://my.app/sitemap.xml');
  });

  it('uses the ORIGIN env override when on localhost', async () => {
    process.env.ORIGIN = 'https://prod.app';
    const event = makeRouteEvent({ url: 'http://localhost:5173/robots.txt' });
    const res = await GET(event as unknown as Parameters<typeof GET>[0]);
    const body = await res.text();
    expect(body).toContain('Sitemap: https://prod.app/sitemap.xml');
  });
});
