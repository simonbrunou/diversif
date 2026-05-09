// Centralised SEO config and helpers. All public-facing pages should derive
// titles, descriptions, canonical URLs and structured data from here so we
// never drift between <title>, OpenGraph, Twitter and JSON-LD.

export const SITE = {
  name: 'Diversif',
  // Fallback used when the request origin is unavailable (e.g. when building
  // the sitemap from a server hook with no event). Override at runtime via
  // the ORIGIN env var, which is also what SvelteKit uses for CSRF.
  defaultOrigin: 'https://diversif.app',
  locale: 'fr_FR',
  lang: 'fr',
  twitter: '@diversif',
  themeColor: '#6b8e6b',
  ogImage: '/og-image.svg',
  ogImageFallback: '/icons/icon-512.png',
  ogImageWidth: 1200,
  ogImageHeight: 630,
  description:
    'Suivez la diversification alimentaire de votre bébé de 4 mois à 3 ans : étapes par âge, 12 allergènes prioritaires, textures, aliments à éviter, conduite à tenir en cas de réaction. Guide sourcé HCSP, Santé publique France, ANSES, ESPGHAN, OMS, études LEAP et EAT. Self-hosted, sans publicité, open source.',
  shortDescription:
    'Diversification alimentaire bébé : guide sourcé, suivi des allergènes, partage à deux parents — adossé HCSP, Santé publique France, ESPGHAN.',
  keywords: [
    'diversification alimentaire',
    'diversification bébé',
    'allergènes bébé',
    'allergènes prioritaires',
    'introduction des allergènes',
    'DME',
    'diversification menée par enfant',
    '4 mois 6 mois bébé',
    'textures bébé',
    'aliments interdits bébé',
    'HCSP diversification',
    'ESPGHAN diversification',
    'étude LEAP',
    'étude EAT',
    'Santé publique France diversification',
    'PNNS bébé'
  ]
} as const;

export type SeoInput = {
  title: string;
  description?: string;
  /** Absolute or root-relative path. Will be resolved against the site origin. */
  path: string;
  ogType?: 'website' | 'article';
  ogImage?: string;
  /** Set to true for auth/private pages we don't want indexed. */
  noindex?: boolean;
  /** Optional ISO publication date for Article-type pages. */
  publishedTime?: string;
  modifiedTime?: string;
};

export function absoluteUrl(origin: string, path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = (origin || SITE.defaultOrigin).replace(/\/$/, '');
  const p = path.startsWith('/') ? path : `/${path}`;
  return `${base}${p}`;
}

/**
 * Resolve a usable origin from either the SvelteKit URL or the ORIGIN env var.
 * Server-only; pass through `+layout.server.ts` for client visibility.
 */
export function resolveOrigin(url?: URL | string | null): string {
  try {
    if (url) {
      const parsed = typeof url === 'string' ? new URL(url) : url;
      // SvelteKit's prerender pipeline passes a placeholder URL with host
      // `sveltekit-prerender`; surfaces that bake the URL into output
      // (robots.txt, sitemap.xml, JSON-LD canonicals) would otherwise leak
      // that host. Treat it as a non-origin: prefer ORIGIN env, then
      // SITE.defaultOrigin.
      const isPrerenderPlaceholder = /^https?:\/\/sveltekit-prerender/i.test(parsed.origin);
      // In dev SvelteKit's URL is the request origin which is fine. Skip
      // private-network origins only if we have a real ORIGIN to fall back to.
      const env = (typeof process !== 'undefined' && process.env?.ORIGIN) || '';
      if (
        env &&
        /^https?:\/\//i.test(env) &&
        !isPrerenderPlaceholder &&
        !/^https?:\/\/(localhost|127\.0\.0\.1|0\.0\.0\.0)/i.test(parsed.origin)
      ) {
        return parsed.origin;
      }
      if (env && /^https?:\/\//i.test(env)) return env.replace(/\/$/, '');
      if (isPrerenderPlaceholder) return SITE.defaultOrigin;
      return parsed.origin;
    }
  } catch {
    // ignore
  }
  if (typeof process !== 'undefined' && process.env?.ORIGIN) {
    return String(process.env.ORIGIN).replace(/\/$/, '');
  }
  return SITE.defaultOrigin;
}

export type BreadcrumbItem = { name: string; path: string };

export function breadcrumbJsonLd(origin: string, items: BreadcrumbItem[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((it, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      name: it.name,
      item: absoluteUrl(origin, it.path)
    }))
  };
}

export function organizationJsonLd(origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name: SITE.name,
    url: absoluteUrl(origin, '/'),
    logo: absoluteUrl(origin, '/icons/icon-512.png'),
    sameAs: ['https://github.com/simonbrunou/diversif']
  };
}

// inLanguage on every type is hardcoded to SITE.lang ('fr'). The /en/ URLs
// only translate chrome (header, footer, skip link, FR-only banner); the
// substantive page bodies — articles, FAQ Q/A, landing copy — remain in
// French. Per schema.org and Google's guidance, inLanguage describes the
// content's actual language, not the URL prefix, so 'fr' is the correct
// signal even on /en/ pages until the bodies themselves get translated.
export function websiteJsonLd(origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    name: SITE.name,
    url: absoluteUrl(origin, '/'),
    inLanguage: SITE.lang,
    description: SITE.shortDescription,
    publisher: { '@type': 'Organization', name: SITE.name }
  };
}

export function webApplicationJsonLd(origin: string) {
  return {
    '@context': 'https://schema.org',
    '@type': 'WebApplication',
    name: SITE.name,
    url: absoluteUrl(origin, '/'),
    applicationCategory: 'HealthApplication',
    operatingSystem: 'Any',
    inLanguage: SITE.lang,
    description: SITE.shortDescription,
    offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
    isAccessibleForFree: true
  };
}

export function articleJsonLd(
  origin: string,
  args: {
    title: string;
    description: string;
    path: string;
    datePublished?: string;
    dateModified?: string;
  }
) {
  return {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: args.title,
    description: args.description,
    inLanguage: SITE.lang,
    mainEntityOfPage: absoluteUrl(origin, args.path),
    image: absoluteUrl(origin, SITE.ogImageFallback),
    author: { '@type': 'Organization', name: SITE.name },
    publisher: {
      '@type': 'Organization',
      name: SITE.name,
      logo: { '@type': 'ImageObject', url: absoluteUrl(origin, '/icons/icon-512.png') }
    },
    datePublished: args.datePublished,
    dateModified: args.dateModified ?? args.datePublished
  };
}

// inLanguage was missing here entirely; the other JSON-LD types had it.
export function faqPageJsonLd(qa: { q: string; a: string }[]) {
  return {
    '@context': 'https://schema.org',
    '@type': 'FAQPage',
    inLanguage: SITE.lang,
    mainEntity: qa.map((it) => ({
      '@type': 'Question',
      name: it.q,
      acceptedAnswer: { '@type': 'Answer', text: it.a }
    }))
  };
}
