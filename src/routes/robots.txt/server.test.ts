import { describe, it, expect } from 'vitest';
import { GET } from './+server';
import { makeRouteEvent } from '../../test/route';
import { SITE } from '$lib/seo';

describe('GET /robots.txt', () => {
  it('returns text/plain with the sitemap URL pinned to SITE.defaultOrigin', async () => {
    // Use a non-prod host to confirm the response ignores the request origin
    // and always points at SITE.defaultOrigin.
    const event = makeRouteEvent({ url: 'https://preview-abc.diversif.app/robots.txt' });
    const res = await GET(event as unknown as Parameters<typeof GET>[0]);
    expect(res.headers.get('content-type')).toContain('text/plain');
    const body = await res.text();
    expect(body).toContain('User-agent: *');
    expect(body).toContain('Disallow: /child/');
    expect(body).toContain('Disallow: /account');
    expect(body).toContain('Disallow: /healthz');
    expect(body).toContain(`Sitemap: ${SITE.defaultOrigin}/sitemap.xml`);
    expect(body).not.toContain('preview-abc');
  });
});
