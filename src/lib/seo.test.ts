import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  SITE,
  absoluteUrl,
  resolveOrigin,
  breadcrumbJsonLd,
  organizationJsonLd,
  websiteJsonLd,
  webApplicationJsonLd,
  articleJsonLd,
  faqPageJsonLd
} from './seo';

describe('SITE config', () => {
  it('exposes a non-empty French locale and lang', () => {
    expect(SITE.lang).toBe('fr');
    expect(SITE.locale).toMatch(/^fr/);
    expect(SITE.defaultOrigin).toMatch(/^https?:\/\//);
  });
});

describe('absoluteUrl', () => {
  it('keeps absolute http(s) URLs untouched', () => {
    expect(absoluteUrl('https://example.com', 'https://other.test/x')).toBe('https://other.test/x');
    expect(absoluteUrl('https://example.com', 'http://plain.test/x')).toBe('http://plain.test/x');
  });

  it('joins origin and path with a single slash', () => {
    expect(absoluteUrl('https://example.com', '/guide')).toBe('https://example.com/guide');
    expect(absoluteUrl('https://example.com/', '/guide')).toBe('https://example.com/guide');
    expect(absoluteUrl('https://example.com', 'guide')).toBe('https://example.com/guide');
  });

  it('falls back to default origin if origin is empty', () => {
    expect(absoluteUrl('', '/x')).toBe(`${SITE.defaultOrigin}/x`);
  });
});

describe('resolveOrigin', () => {
  const ORIGINAL = process.env.ORIGIN;
  beforeEach(() => {
    delete process.env.ORIGIN;
  });
  afterEach(() => {
    if (ORIGINAL === undefined) delete process.env.ORIGIN;
    else process.env.ORIGIN = ORIGINAL;
  });

  it('returns the URL origin when no env override is set', () => {
    expect(resolveOrigin(new URL('https://my.app/path'))).toBe('https://my.app');
  });

  it('accepts a string URL', () => {
    expect(resolveOrigin('https://my.app/path')).toBe('https://my.app');
  });

  it('prefers ORIGIN env var when request is on localhost', () => {
    process.env.ORIGIN = 'https://prod.app';
    expect(resolveOrigin(new URL('http://localhost:5173/'))).toBe('https://prod.app');
    expect(resolveOrigin(new URL('http://127.0.0.1:5173/'))).toBe('https://prod.app');
    expect(resolveOrigin(new URL('http://0.0.0.0:5173/'))).toBe('https://prod.app');
  });

  it('strips trailing slash from the env override', () => {
    process.env.ORIGIN = 'https://prod.app/';
    expect(resolveOrigin(new URL('http://localhost:5173/'))).toBe('https://prod.app');
  });

  it('uses the request origin when env override is non-http', () => {
    process.env.ORIGIN = 'not-a-url';
    expect(resolveOrigin(new URL('https://my.app/'))).toBe('https://my.app');
  });

  it('uses the env override when no URL is provided', () => {
    process.env.ORIGIN = 'https://prod.app';
    expect(resolveOrigin(null)).toBe('https://prod.app');
    expect(resolveOrigin(undefined)).toBe('https://prod.app');
  });

  it('falls back to default when nothing is provided', () => {
    expect(resolveOrigin(null)).toBe(SITE.defaultOrigin);
  });

  it('keeps the request origin if env override is also a real (non-local) origin', () => {
    process.env.ORIGIN = 'https://prod.app';
    expect(resolveOrigin(new URL('https://staging.app/x'))).toBe('https://staging.app');
  });

  it('falls through gracefully when given a malformed URL string', () => {
    expect(resolveOrigin('not a url')).toBe(SITE.defaultOrigin);
  });

  it("falls back to ORIGIN when the URL is SvelteKit's prerender placeholder", () => {
    process.env.ORIGIN = 'https://prod.app';
    expect(resolveOrigin(new URL('http://sveltekit-prerender/robots.txt'))).toBe(
      'https://prod.app'
    );
  });

  it("falls back to SITE.defaultOrigin on prerender placeholder when ORIGIN isn't set", () => {
    expect(resolveOrigin(new URL('http://sveltekit-prerender/sitemap.xml'))).toBe(
      SITE.defaultOrigin
    );
  });
});

describe('JSON-LD generators', () => {
  const origin = 'https://test.app';

  it('builds a BreadcrumbList with positional items', () => {
    const ld = breadcrumbJsonLd(origin, [
      { name: 'Accueil', path: '/' },
      { name: 'Guide', path: '/guide' }
    ]);
    expect(ld['@type']).toBe('BreadcrumbList');
    expect(ld.itemListElement).toHaveLength(2);
    expect(ld.itemListElement[0]).toMatchObject({
      position: 1,
      name: 'Accueil',
      item: `${origin}/`
    });
    expect(ld.itemListElement[1]).toMatchObject({
      position: 2,
      name: 'Guide',
      item: `${origin}/guide`
    });
  });

  it('builds an Organization JSON-LD with logo and sameAs', () => {
    const ld = organizationJsonLd(origin);
    expect(ld['@type']).toBe('Organization');
    expect(ld.url).toBe(`${origin}/`);
    expect(ld.logo).toBe(`${origin}/icons/icon-512.png`);
    expect(ld.sameAs).toContain('https://github.com/simonbrunou/diversif');
  });

  it('builds a WebSite JSON-LD with publisher', () => {
    const ld = websiteJsonLd(origin);
    expect(ld['@type']).toBe('WebSite');
    expect(ld.url).toBe(`${origin}/`);
    expect(ld.inLanguage).toBe('fr');
    expect(ld.publisher).toEqual({ '@type': 'Organization', name: SITE.name });
  });

  it('builds a WebApplication JSON-LD with a free Offer', () => {
    const ld = webApplicationJsonLd(origin);
    expect(ld['@type']).toBe('WebApplication');
    expect(ld.applicationCategory).toBe('HealthApplication');
    expect(ld.offers).toMatchObject({ price: '0', priceCurrency: 'EUR' });
    expect(ld.isAccessibleForFree).toBe(true);
  });

  it('builds an Article JSON-LD with publisher logo', () => {
    const ld = articleJsonLd(origin, {
      title: 'Guide',
      description: 'Desc',
      path: '/guide',
      datePublished: '2025-01-01',
      dateModified: '2026-05-01'
    });
    expect(ld['@type']).toBe('Article');
    expect(ld.headline).toBe('Guide');
    expect(ld.mainEntityOfPage).toBe(`${origin}/guide`);
    expect(ld.image).toBe(`${origin}${SITE.ogImageFallback}`);
    expect(ld.publisher).toMatchObject({ logo: { url: `${origin}/icons/icon-512.png` } });
    expect(ld.datePublished).toBe('2025-01-01');
    expect(ld.dateModified).toBe('2026-05-01');
  });

  it('falls back dateModified to datePublished when not provided', () => {
    const ld = articleJsonLd(origin, {
      title: 'X',
      description: 'Y',
      path: '/x',
      datePublished: '2025-06-01'
    });
    expect(ld.dateModified).toBe('2025-06-01');
  });

  it('builds a FAQPage with inLanguage from a list of Q/A pairs', () => {
    const ld = faqPageJsonLd([
      { q: 'Q1', a: 'A1' },
      { q: 'Q2', a: 'A2' }
    ]);
    expect(ld['@type']).toBe('FAQPage');
    expect(ld.inLanguage).toBe('fr');
    expect(ld.mainEntity).toHaveLength(2);
    expect(ld.mainEntity[0]).toMatchObject({
      '@type': 'Question',
      name: 'Q1',
      acceptedAnswer: { '@type': 'Answer', text: 'A1' }
    });
  });
});
