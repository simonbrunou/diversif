<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Button from '$components/ui/Button.svelte';
  import Callout from '$lib/components/ui/Callout.svelte';
  import LandingHeroBento from '$lib/components/landing/LandingHeroBento.svelte';
  import LandingFeaturesBento from '$lib/components/landing/LandingFeaturesBento.svelte';
  import LandingTrustBento from '$lib/components/landing/LandingTrustBento.svelte';
  import LandingClosingCtaBento from '$lib/components/landing/LandingClosingCtaBento.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import JsonLd from '$lib/components/JsonLd.svelte';
  import { SITE, faqPageJsonLd, webApplicationJsonLd } from '$lib/seo';
  import { page } from '$app/stores';
  import { formatAge } from '$lib/utils/age';
  import { localizedHref } from '$lib/utils/localized-href';
  import * as m from '$lib/paraglide/messages';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const siteUrl = $derived($page.data.siteUrl ?? SITE.defaultOrigin);

  const landingFaq = $derived([
    {
      q: m.landingFaqQ1(),
      a: m.landingFaqA1()
    },
    {
      q: m.landingFaqQ2(),
      a: m.landingFaqA2()
    },
    {
      q: m.landingFaqQ3(),
      a: m.landingFaqA3()
    },
    {
      q: m.landingFaqQ4(),
      a: m.landingFaqA4()
    },
    {
      q: m.landingFaqQ5(),
      a: m.landingFaqA5()
    }
  ]);
</script>

{#if data.kind === 'landing'}
  <Seo
    title="Diversif : Diversification alimentaire bébé : guide, suivi, partage parents"
    description={SITE.description}
    path="/"
  />
  <JsonLd data={webApplicationJsonLd(siteUrl)} />
  <JsonLd data={faqPageJsonLd(landingFaq)} />
{:else}
  <Seo title={`${m.kidPickerTitle()} · ${SITE.name}`} path="/" noindex />
{/if}

{#if data.kind === 'landing'}
  {#if $page.url.pathname.startsWith('/en')}
    <div class="container max-w-4xl pt-4 md:pt-6">
      <Callout variant="warning">
        {m.commonFrOnlyBannerLanding()}
      </Callout>
    </div>
  {/if}
  <LandingHeroBento child={null} />
  <LandingFeaturesBento />

  <section class="container max-w-4xl pb-4 text-center">
    <p class="text-sm text-muted-foreground">{m.kidPickerGuideChipNoAccount()}</p>
    <ul class="mt-3 flex flex-wrap justify-center gap-2">
      {#each [{ href: '/guide#regles', label: m.kidPickerGuideChipRules() }, { href: '/guide#etapes', label: m.kidPickerGuideChipStages() }, { href: '/guide#allergenes', label: m.kidPickerGuideChipAllergens() }] as chip (chip.href)}
        <li>
          <a
            href={localizedHref(chip.href)}
            class="inline-flex items-center rounded-full border bg-background px-3 py-1 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
          >
            {chip.label}
          </a>
        </li>
      {/each}
    </ul>
  </section>

  <LandingTrustBento />
  <LandingClosingCtaBento />
{:else}
  <div class="container max-w-2xl py-10">
    <h1 class="text-2xl font-semibold">{m.kidPickerTitle()}</h1>
    <p class="mt-2 text-sm text-muted-foreground">{m.kidPickerSubtitle()}</p>

    <div class="mt-6 grid gap-3">
      {#each data.children as child (child.id)}
        <a href={localizedHref(`/child/${child.id}`)} class="block">
          <Card class="p-4 transition-colors hover:bg-accent">
            <div class="flex items-center justify-between">
              <div>
                <div class="font-medium">{child.name}</div>
                <div class="text-sm text-muted-foreground">{formatAge(child.birthDate)}</div>
              </div>
              <span class="text-xs text-muted-foreground">
                {child.role === 'owner' ? m.kidPickerRoleOwner() : m.kidPickerRoleMember()}
              </span>
            </div>
          </Card>
        </a>
      {/each}
    </div>

    <div class="mt-6">
      <Button href={localizedHref('/child/new')} variant="outline">{m.kidPickerAddChild()}</Button>
    </div>
  </div>
{/if}
