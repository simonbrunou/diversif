import type { RequestHandler } from './$types';
import { absoluteUrl, resolveOrigin } from '$lib/seo';

export const prerender = true;

type Entry = { path: string; changefreq: string; priority: string; lastmod: string };

const STATIC_PAGES: Omit<Entry, 'lastmod'>[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0' },
  { path: '/guide', changefreq: 'monthly', priority: '0.9' },
  { path: '/allergens', changefreq: 'monthly', priority: '0.9' },
  { path: '/sources', changefreq: 'yearly', priority: '0.6' }
];

const GUIDE_ANCHORS = [
  'regles',
  'etapes',
  'allergenes',
  'categories',
  'textures',
  'eviter',
  'reactions',
  'approches',
  'sources'
];

function escapeXml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export const GET: RequestHandler = ({ url }) => {
  const origin = resolveOrigin(url);
  const today = new Date().toISOString().slice(0, 10);
  const entries: Entry[] = [
    ...STATIC_PAGES.map((p) => ({ ...p, lastmod: today })),
    // Anchored sub-sections of the guide help search engines surface deep links.
    ...GUIDE_ANCHORS.map((id) => ({
      path: `/guide#${id}`,
      changefreq: 'monthly',
      priority: '0.5',
      lastmod: today
    }))
  ];

  const body =
    '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries
      .map((e) => {
        const loc = escapeXml(absoluteUrl(origin, e.path));
        return (
          '  <url>\n' +
          `    <loc>${loc}</loc>\n` +
          `    <lastmod>${e.lastmod}</lastmod>\n` +
          `    <changefreq>${e.changefreq}</changefreq>\n` +
          `    <priority>${e.priority}</priority>\n` +
          '  </url>'
        );
      })
      .join('\n') +
    '\n</urlset>\n';

  return new Response(body, {
    headers: {
      'content-type': 'application/xml; charset=utf-8',
      'cache-control': 'public, max-age=3600'
    }
  });
};
