import type { RequestHandler } from './$types';
import { SITE } from '$lib/seo';

export const prerender = true;

export const GET: RequestHandler = () => {
  // Sitemap pointer pinned to prod canonical — see sitemap.xml/+server.ts.
  const origin = SITE.defaultOrigin;
  const body = [
    'User-agent: *',
    'Allow: /',
    // Auth and per-child surfaces are private state; keep them out of the index.
    'Disallow: /login',
    'Disallow: /signup',
    'Disallow: /logout',
    'Disallow: /account',
    'Disallow: /child/',
    'Disallow: /join/',
    'Disallow: /healthz',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    ''
  ].join('\n');

  return new Response(body, {
    headers: {
      'content-type': 'text/plain; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
};
