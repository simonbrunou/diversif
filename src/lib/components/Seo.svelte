<script lang="ts">
  import { page } from '$app/stores';
  import { SITE, absoluteUrl, type SeoInput } from '$lib/seo';

  let {
    title,
    description = SITE.shortDescription,
    path,
    ogType = 'website',
    ogImage = SITE.ogImage,
    noindex = false,
    publishedTime,
    modifiedTime,
    alternateLocales = []
  }: SeoInput & { alternateLocales?: string[] } = $props();

  const origin = $derived($page.data.siteUrl ?? SITE.defaultOrigin);
  const canonical = $derived(absoluteUrl(origin, path));
  const ogImageUrl = $derived(absoluteUrl(origin, ogImage));
  const ogImageFallback = $derived(absoluteUrl(origin, SITE.ogImageFallback));
</script>

<svelte:head>
  <title>{title}</title>
  <meta name="description" content={description} />
  <link rel="canonical" href={canonical} />
  {#if alternateLocales.length > 0}
    <link rel="alternate" hreflang="fr" href={canonical} />
    {#each alternateLocales as locale}
      <link
        rel="alternate"
        hreflang={locale}
        href={absoluteUrl(origin, `/${locale}${path === '/' ? '' : path}`)}
      />
    {/each}
    <link rel="alternate" hreflang="x-default" href={canonical} />
  {/if}
  {#if noindex}
    <meta name="robots" content="noindex, nofollow" />
  {:else}
    <meta name="robots" content="index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1" />
  {/if}

  <meta property="og:site_name" content={SITE.name} />
  <meta property="og:locale" content={SITE.locale} />
  <meta property="og:type" content={ogType} />
  <meta property="og:title" content={title} />
  <meta property="og:description" content={description} />
  <meta property="og:url" content={canonical} />
  <meta property="og:image" content={ogImageUrl} />
  <meta property="og:image:secure_url" content={ogImageUrl} />
  <meta property="og:image:alt" content={title} />
  <meta property="og:image:width" content={String(SITE.ogImageWidth)} />
  <meta property="og:image:height" content={String(SITE.ogImageHeight)} />
  <!-- Raster fallback so crawlers that won't render SVG still get a card. -->
  <meta property="og:image" content={ogImageFallback} />
  {#if publishedTime}
    <meta property="article:published_time" content={publishedTime} />
  {/if}
  {#if modifiedTime}
    <meta property="article:modified_time" content={modifiedTime} />
  {/if}

  <meta name="twitter:card" content="summary_large_image" />
  <meta name="twitter:title" content={title} />
  <meta name="twitter:description" content={description} />
  <meta name="twitter:image" content={ogImageFallback} />
  <meta name="twitter:image:alt" content={title} />
</svelte:head>
