import { describe, it, expect } from 'vitest';
import { GET } from './+server';
import { makeRouteEvent } from '../../test/route';
import { SITE } from '$lib/seo';

describe('GET /sitemap.xml', () => {
  it('returns an XML sitemap with absolute URLs pinned to SITE.defaultOrigin', async () => {
    // Request URL is intentionally a different host — sitemap must ignore it
    // and emit canonical-only entries pointing at SITE.defaultOrigin.
    const event = makeRouteEvent({ url: 'https://preview-abc.diversif.app/sitemap.xml' });
    const res = await GET(event as unknown as Parameters<typeof GET>[0]);
    expect(res.headers.get('content-type')).toContain('application/xml');
    const body = await res.text();
    expect(body).toContain('<?xml');
    expect(body).toContain('<urlset');
    expect(body).toContain(`<loc>${SITE.defaultOrigin}/</loc>`);
    expect(body).toContain(`<loc>${SITE.defaultOrigin}/guide</loc>`);
    expect(body).toContain(`<loc>${SITE.defaultOrigin}/allergens</loc>`);
    expect(body).toContain(`<loc>${SITE.defaultOrigin}/sources</loc>`);
    expect(body).not.toContain('preview-abc');
    expect(body).toMatch(/<lastmod>\d{4}-\d{2}-\d{2}<\/lastmod>/);
    expect(body).toContain('<changefreq>weekly</changefreq>');
    expect(body).toContain('<priority>1.0</priority>');
  });

  it('includes anchored guide subsections with XML-escaped URLs', async () => {
    const event = makeRouteEvent({ url: 'https://my.app/sitemap.xml' });
    const res = await GET(event as unknown as Parameters<typeof GET>[0]);
    const body = await res.text();
    expect(body).toContain(`<loc>${SITE.defaultOrigin}/guide#regles</loc>`);
    expect(body).toContain(`<loc>${SITE.defaultOrigin}/guide#allergenes</loc>`);
  });

  it('does NOT include any /en entries (chrome-only translations + noindex auth)', async () => {
    const event = makeRouteEvent({ url: 'https://my.app/sitemap.xml' });
    const res = await GET(event as unknown as Parameters<typeof GET>[0]);
    const body = await res.text();
    expect(body).not.toContain('/en');
  });
});
