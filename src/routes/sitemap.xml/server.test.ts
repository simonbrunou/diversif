import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GET } from './+server';
import { makeRouteEvent } from '../../test/route';

describe('GET /sitemap.xml', () => {
  const ORIGINAL = process.env.ORIGIN;
  beforeEach(() => {
    delete process.env.ORIGIN;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ORIGIN;
    else process.env.ORIGIN = ORIGINAL;
  });

  it('returns an XML sitemap with absolute URLs and required tags', async () => {
    const event = makeRouteEvent({ url: 'https://my.app/sitemap.xml' });
    const res = await GET(event as unknown as Parameters<typeof GET>[0]);
    expect(res.headers.get('content-type')).toContain('application/xml');
    const body = await res.text();
    expect(body).toContain('<?xml');
    expect(body).toContain('<urlset');
    expect(body).toContain('<loc>https://my.app/</loc>');
    expect(body).toContain('<loc>https://my.app/guide</loc>');
    expect(body).toContain('<loc>https://my.app/allergens</loc>');
    expect(body).toContain('<loc>https://my.app/sources</loc>');
    expect(body).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    expect(body).toContain('<changefreq>weekly</changefreq>');
    expect(body).toContain('<priority>1.0</priority>');
  });

  it('includes anchored guide subsections with XML-escaped URLs', async () => {
    const event = makeRouteEvent({ url: 'https://my.app/sitemap.xml' });
    const res = await GET(event as unknown as Parameters<typeof GET>[0]);
    const body = await res.text();
    // The `#` is fine in URLs but we still want it serialized intact.
    expect(body).toContain('<loc>https://my.app/guide#regles</loc>');
    expect(body).toContain('<loc>https://my.app/guide#allergenes</loc>');
  });

  it('honours the ORIGIN env override when called on localhost', async () => {
    process.env.ORIGIN = 'https://prod.app';
    const event = makeRouteEvent({ url: 'http://localhost:5173/sitemap.xml' });
    const res = await GET(event as unknown as Parameters<typeof GET>[0]);
    const body = await res.text();
    expect(body).toContain('<loc>https://prod.app/</loc>');
    expect(body).not.toContain('localhost');
  });

  it('includes EN counterparts for translated routes', async () => {
    const event = makeRouteEvent({ url: 'https://my.app/sitemap.xml' });
    const res = await GET(event as unknown as Parameters<typeof GET>[0]);
    const body = await res.text();
    expect(body).toContain('<loc>https://my.app/en/login</loc>');
    expect(body).toContain('<loc>https://my.app/en/signup</loc>');
    expect(body).toContain('<loc>https://my.app/en/cookies</loc>');
  });

  it('does NOT advertise the EN landing page (chrome-only translation)', async () => {
    const event = makeRouteEvent({ url: 'https://my.app/sitemap.xml' });
    const res = await GET(event as unknown as Parameters<typeof GET>[0]);
    const body = await res.text();
    expect(body).not.toContain('<loc>https://my.app/en</loc>');
  });

  it('does NOT include EN entries for FR-only routes', async () => {
    const event = makeRouteEvent({ url: 'https://my.app/sitemap.xml' });
    const res = await GET(event as unknown as Parameters<typeof GET>[0]);
    const body = await res.text();
    expect(body).not.toContain('/en/mentions-legales');
    expect(body).not.toContain('/en/politique-confidentialite');
    expect(body).not.toContain('/en/sources');
  });
});
