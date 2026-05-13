<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Button from '$components/ui/Button.svelte';
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

  const landingFaq = [
    {
      q: 'Quand commencer la diversification alimentaire de mon bébé ?',
      a: "Les recommandations françaises (HCSP 2020, Santé publique France) et européennes (ESPGHAN 2017) convergent : la diversification se commence entre 4 et 6 mois révolus, jamais avant 4 mois (17 semaines), idéalement avant 6 mois pour profiter de la fenêtre d'introduction des allergènes."
    },
    {
      q: 'Quels allergènes sont à introduire tôt ?',
      a: "HCSP 2020 et les études LEAP (2015) et EAT (2016) recommandent une introduction précoce (dès 4–6 mois) pour : œuf, arachide, lait de vache, gluten (blé), poisson, fruits à coque (en purée), sésame. L'app trace 12 allergènes au total (référence : règlement UE 1169/2011 d'étiquetage, moins lupin et sulfites) ; les autres (crustacés, mollusques, céleri, moutarde) sont suivis pour la complétude du carnet. Le soja n'est pas dans la liste à introduire tôt : HCSP et ANSES déconseillent les produits à base de soja avant 3 ans."
    },
    {
      q: 'Faut-il choisir entre purées et DME (diversification menée par l\'enfant) ?',
      a: "Non. La Société Française de Pédiatrie reconnaît la DME, les purées classiques et l'approche mixte comme valides. L'important est d'adapter la texture à l'âge, surveiller les signes d'étouffement et proposer une alimentation variée."
    },
    {
      q: 'Quels aliments éviter avant 1 an et avant 3 ans ?',
      a: "Avant 1 an : miel (botulisme), lait de vache nature en boisson, sel ajouté, sucre ajouté, jus de fruits. Avant 3 ans : aliments crus à risque (œufs crus, viandes/poissons crus), aliments durs et ronds (cacahuètes, raisins entiers), boissons sucrées et édulcorées."
    },
    {
      q: 'Diversif est-il gratuit et sans publicité ?',
      a: 'Oui. Diversif est open source, self-hosted, gratuit et sans publicité. Vos données restent sur votre propre serveur ou hébergeur.'
    }
  ];
</script>

{#if data.kind === 'landing'}
  <Seo
    title="Diversif — Diversification alimentaire bébé : guide, suivi, partage parents"
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
      <aside
        class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900"
        role="note"
      >
        {m.commonFrOnlyBannerLanding()}
      </aside>
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
