import type { RequestHandler } from './$types';
import { SITE, absoluteUrl } from '$lib/seo';

export const prerender = true;

type Entry = { path: string; changefreq: string; priority: string; lastmod: string };

// Stable per-page content update dates. Bump the appropriate entry whenever the
// page's user-visible content meaningfully changes : never use "today" at
// response time, since a rolling `lastmod` makes crawlers distrust the signal
// and triggers unnecessary recrawls of pages that haven't actually changed.
const LANDING_LASTMOD = '2026-05-03';
const GUIDE_LASTMOD = '2026-05-03';
const ALLERGENS_LASTMOD = '2026-05-03';
const SOURCES_LASTMOD = '2026-05-03';
const AIDE_LASTMOD = '2026-06-04';

const STATIC_PAGES: Entry[] = [
  { path: '/', changefreq: 'weekly', priority: '1.0', lastmod: LANDING_LASTMOD },
  { path: '/guide', changefreq: 'monthly', priority: '0.9', lastmod: GUIDE_LASTMOD },
  { path: '/allergens', changefreq: 'monthly', priority: '0.9', lastmod: ALLERGENS_LASTMOD },
  { path: '/sources', changefreq: 'yearly', priority: '0.6', lastmod: SOURCES_LASTMOD },
  { path: '/aide', changefreq: 'yearly', priority: '0.5', lastmod: AIDE_LASTMOD }
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

export const GET: RequestHandler = () => {
  // Canonical URLs always point to prod (SITE.defaultOrigin) — never the
  // request host. Preview-deploy sitemaps would otherwise leak preview
  // hostnames into the index, see SITE.defaultOrigin's comment.
  const origin = SITE.defaultOrigin;
  const entries: Entry[] = [
    ...STATIC_PAGES,
    // Anchored sub-sections share the guide's lastmod since they all point
    // into the same page's content.
    ...GUIDE_ANCHORS.map((id) => ({
      path: `/guide#${id}`,
      changefreq: 'monthly',
      priority: '0.5',
      lastmod: GUIDE_LASTMOD
    }))
    // No EN entries: the only routes with EN body translations (login/signup/
    // cookies) are noindex, so submitting them conflicts with their robots
    // directive. The chrome-only translation on /, /guide, /allergens, /sources
    // does not qualify the FR pages as having English equivalents either.
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
