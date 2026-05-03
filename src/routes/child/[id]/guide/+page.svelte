<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Badge from '$components/ui/Badge.svelte';
  import Button from '$components/ui/Button.svelte';
  import StageBadge from '$lib/components/StageBadge.svelte';
  import SourceCitation from '$lib/components/SourceCitation.svelte';
  import AllergenInfoDialog from '$lib/components/AllergenInfoDialog.svelte';
  import { ALLERGENS, type AllergenId } from '$lib/utils/allergens';
  import {
    STAGES,
    KEY_PRINCIPLES,
    ALLERGEN_GUIDANCE,
    CATEGORY_GUIDANCE,
    TEXTURE_PROGRESSION,
    FORBIDDEN_FOODS,
    CHOKING_HAZARDS,
    REACTION_GUIDANCE,
    APPROACHES,
    EMERGENCY_NUMBER,
    getStageForAgeMonths
  } from '$lib/content/guidance';
  import { CATEGORIES } from '$lib/utils/categories';
  import { SOURCES, type SourceId } from '$lib/content/sources';
  import {
    BookOpen,
    Compass,
    Sparkles,
    Layers,
    ShieldCheck,
    UtensilsCrossed,
    AlertTriangle,
    HeartPulse,
    Users,
    Library,
    ExternalLink,
    Phone
  } from 'lucide-svelte';
  import type { PageData } from './$types';

  let { data }: { data: PageData } = $props();

  const currentStage = $derived(getStageForAgeMonths(data.ageMonths));
  let openAllergenId = $state<AllergenId | null>(null);

  const allSourceIds = Object.keys(SOURCES) as SourceId[];

  const sections = [
    { id: 'etape', label: 'Étape actuelle', icon: Compass },
    { id: 'regles', label: 'Règles d\'or', icon: Sparkles },
    { id: 'etapes', label: 'Les 4 étapes', icon: Layers },
    { id: 'allergenes', label: 'Allergènes', icon: ShieldCheck },
    { id: 'categories', label: 'Groupes alimentaires', icon: UtensilsCrossed },
    { id: 'textures', label: 'Textures', icon: Layers },
    { id: 'eviter', label: 'À éviter', icon: AlertTriangle },
    { id: 'reactions', label: 'Réactions', icon: HeartPulse },
    { id: 'approches', label: 'Approches', icon: Users },
    { id: 'sources', label: 'Sources', icon: Library }
  ] as const;
</script>

<div class="container max-w-4xl space-y-8 py-6 md:py-8">
  <header class="space-y-2">
    <a
      href={`/child/${data.child.id}`}
      class="text-sm text-muted-foreground hover:underline"
    >
      ← Tableau
    </a>
    <div class="mt-2 flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-primary/80">
      <BookOpen size={14} aria-hidden="true" />
      Guide de la diversification
    </div>
    <h1 class="text-2xl font-semibold leading-tight md:text-3xl">
      Diversifier en confiance, sources à l'appui
    </h1>
    <p class="max-w-2xl text-sm text-muted-foreground">
      L'essentiel sur la diversification alimentaire de 4 mois à 3 ans : démarrer, allergènes,
      textures, aliments à éviter, conduite à tenir en cas de réaction. Toutes les recommandations
      renvoient à leurs sources officielles.
    </p>
  </header>

  <!-- In-page nav -->
  <nav aria-label="Sommaire du guide" class="rounded-lg border bg-surface p-3">
    <ul class="flex flex-wrap gap-2 text-xs">
      {#each sections as s (s.id)}
        {@const Icon = s.icon}
        <li>
          <a
            href={`#${s.id}`}
            class="inline-flex items-center gap-1.5 rounded-full border bg-background px-3 py-1 font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <Icon size={12} aria-hidden="true" />
            {s.label}
          </a>
        </li>
      {/each}
    </ul>
  </nav>

  <!-- 1. Current stage -->
  <section id="etape" class="scroll-mt-6 space-y-3">
    <div class="flex items-center gap-2">
      <Compass size={18} class="text-primary" aria-hidden="true" />
      <h2 class="text-xl font-semibold">Où en est bébé</h2>
    </div>
    <Card class="p-5 md:p-6">
      <div class="flex flex-wrap items-center gap-3">
        <StageBadge stage={currentStage} />
        <span class="text-xs text-muted-foreground">Bébé a {data.ageMonths} mois</span>
      </div>
      <h3 class="mt-3 text-lg font-semibold leading-tight">{currentStage.title}</h3>
      <p class="mt-1 text-sm text-foreground/90">{currentStage.oneLiner}</p>

      <div class="mt-4 grid gap-4 sm:grid-cols-2">
        <div>
          <h4 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Principes
          </h4>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
            {#each currentStage.principles as p, i (i)}
              <li>{p}</li>
            {/each}
          </ul>
        </div>
        <div>
          <h4 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Aliments à proposer
          </h4>
          <ul class="mt-2 list-disc space-y-1 pl-5 text-sm text-foreground/90">
            {#each currentStage.focus as p, i (i)}
              <li>{p}</li>
            {/each}
          </ul>
        </div>
      </div>

      <div class="mt-4 grid gap-3 sm:grid-cols-2">
        <div class="rounded-md border bg-muted/40 p-3 text-sm">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Texture
          </div>
          <p class="mt-1">{currentStage.textures}</p>
        </div>
        <div class="rounded-md border bg-muted/40 p-3 text-sm">
          <div class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Lait
          </div>
          <p class="mt-1">{currentStage.milkTarget}</p>
        </div>
      </div>

      {#if currentStage.redFlags.length > 0}
        <div class="mt-4 rounded-md border border-reaction-inconfort/30 bg-reaction-inconfort/5 p-3 text-sm">
          <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-reaction-inconfort">
            <AlertTriangle size={12} aria-hidden="true" />
            À surveiller
          </div>
          <ul class="mt-1 list-disc space-y-1 pl-5">
            {#each currentStage.redFlags as f, i (i)}
              <li>{f}</li>
            {/each}
          </ul>
        </div>
      {/if}

      <div class="mt-4">
        <SourceCitation ids={[...currentStage.sources]} inline />
      </div>
    </Card>
  </section>

  <!-- 2. Key principles -->
  <section id="regles" class="scroll-mt-6 space-y-3">
    <div class="flex items-center gap-2">
      <Sparkles size={18} class="text-primary" aria-hidden="true" />
      <h2 class="text-xl font-semibold">Les 10 règles d'or</h2>
    </div>
    <div class="grid gap-3 sm:grid-cols-2">
      {#each KEY_PRINCIPLES as p (p.id)}
        <Card class="p-4">
          <h3 class="text-sm font-semibold">{p.title}</h3>
          <p class="mt-1 text-sm text-foreground/90">{p.body}</p>
          <div class="mt-2">
            <SourceCitation ids={[...p.sources]} inline />
          </div>
        </Card>
      {/each}
    </div>
  </section>

  <!-- 3. The 4 stages -->
  <section id="etapes" class="scroll-mt-6 space-y-3">
    <div class="flex items-center gap-2">
      <Layers size={18} class="text-primary" aria-hidden="true" />
      <h2 class="text-xl font-semibold">Les 4 étapes</h2>
    </div>
    <div class="space-y-3">
      {#each STAGES as s (s.id)}
        <details class="group rounded-lg border bg-card" open={s.id === currentStage.id}>
          <summary class="flex cursor-pointer items-start justify-between gap-3 p-4">
            <div class="min-w-0">
              <div class="flex items-center gap-2">
                <StageBadge stage={s} />
                {#if s.id === currentStage.id}
                  <Badge variant="default">Actuelle</Badge>
                {/if}
              </div>
              <h3 class="mt-2 text-base font-semibold">{s.title}</h3>
              <p class="mt-1 text-sm text-muted-foreground">{s.oneLiner}</p>
            </div>
          </summary>
          <div class="space-y-4 border-t p-4 text-sm">
            <div>
              <h4 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Principes
              </h4>
              <ul class="mt-1 list-disc space-y-1 pl-5">
                {#each s.principles as p, i (i)}
                  <li>{p}</li>
                {/each}
              </ul>
            </div>
            <div>
              <h4 class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                Aliments à proposer
              </h4>
              <ul class="mt-1 list-disc space-y-1 pl-5">
                {#each s.focus as p, i (i)}
                  <li>{p}</li>
                {/each}
              </ul>
            </div>
            <div class="grid gap-3 sm:grid-cols-2">
              <div class="rounded-md border bg-muted/40 p-3">
                <div class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Texture
                </div>
                <p class="mt-1">{s.textures}</p>
              </div>
              <div class="rounded-md border bg-muted/40 p-3">
                <div class="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                  Lait
                </div>
                <p class="mt-1">{s.milkTarget}</p>
              </div>
            </div>
            {#if s.redFlags.length > 0}
              <div class="rounded-md border border-reaction-inconfort/30 bg-reaction-inconfort/5 p-3">
                <div class="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-wider text-reaction-inconfort">
                  <AlertTriangle size={12} aria-hidden="true" />
                  À surveiller
                </div>
                <ul class="mt-1 list-disc space-y-1 pl-5">
                  {#each s.redFlags as f, i (i)}
                    <li>{f}</li>
                  {/each}
                </ul>
              </div>
            {/if}
            <SourceCitation ids={[...s.sources]} inline />
          </div>
        </details>
      {/each}
    </div>
  </section>

  <!-- 4. Allergens -->
  <section id="allergenes" class="scroll-mt-6 space-y-3">
    <div class="flex items-center gap-2">
      <ShieldCheck size={18} class="text-primary" aria-hidden="true" />
      <h2 class="text-xl font-semibold">Les 12 allergènes majeurs</h2>
    </div>
    <Card class="p-4 md:p-5">
      <p class="text-sm text-foreground/90">
        Les recommandations actuelles sont claires : <strong>ne plus retarder l'introduction</strong>
        des allergènes. La fenêtre 4–11 mois est clé pour réduire le risque d'allergie.
      </p>
      <p class="mt-2 text-sm text-foreground/90">
        L'étude <strong>LEAP</strong> a montré que l'introduction précoce de l'arachide réduisait
        de 86 % le risque d'allergie chez les nourrissons à risque. L'étude <strong>EAT</strong>,
        portant sur 6 allergènes (arachide, œuf, lait, sésame, poisson, blé) introduits dès 3–4
        mois, a divisé par 3 la prévalence d'allergies alimentaires.
      </p>
      <div class="mt-3">
        <SourceCitation ids={['leap-2015', 'eat-2016', 'espghan-2017', 'hcsp-2020']} inline />
      </div>
    </Card>

    <div class="grid gap-2 sm:grid-cols-2">
      {#each ALLERGENS as a (a.id)}
        {@const g = ALLERGEN_GUIDANCE[a.id]}
        <button
          type="button"
          onclick={() => (openAllergenId = a.id)}
          class="rounded-lg border bg-card p-3 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
        >
          <div class="flex items-center justify-between gap-2">
            <span class="font-medium">{a.label}</span>
            <Badge variant="default" class="shrink-0 text-[10px]">
              Dès {g.recommendedAgeMonths} mois
            </Badge>
          </div>
          <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{g.why}</p>
        </button>
      {/each}
    </div>
  </section>

  <!-- 5. Categories -->
  <section id="categories" class="scroll-mt-6 space-y-3">
    <div class="flex items-center gap-2">
      <UtensilsCrossed size={18} class="text-primary" aria-hidden="true" />
      <h2 class="text-xl font-semibold">Groupes alimentaires</h2>
    </div>
    <div class="grid gap-3 sm:grid-cols-2">
      {#each CATEGORIES as c (c.id)}
        {#if c.id !== 'autre'}
          {@const g = CATEGORY_GUIDANCE[c.id]}
          <Card class="p-4">
            <h3 class="text-sm font-semibold">{c.label}</h3>
            <p class="mt-1 text-sm text-foreground/90">{g.why}</p>
            <dl class="mt-2 grid grid-cols-1 gap-1 text-xs text-muted-foreground">
              <div><span class="font-medium text-foreground/80">Quand :</span> {g.whenStart}</div>
              <div>
                <span class="font-medium text-foreground/80">Fréquence :</span> {g.cadence}
              </div>
              {#if g.examples.length > 0}
                <div>
                  <span class="font-medium text-foreground/80">Exemples :</span>
                  {g.examples.join(', ')}
                </div>
              {/if}
            </dl>
            {#if g.sources.length > 0}
              <div class="mt-2">
                <SourceCitation ids={[...g.sources]} inline />
              </div>
            {/if}
          </Card>
        {/if}
      {/each}
    </div>
  </section>

  <!-- 6. Textures -->
  <section id="textures" class="scroll-mt-6 space-y-3">
    <div class="flex items-center gap-2">
      <Layers size={18} class="text-primary" aria-hidden="true" />
      <h2 class="text-xl font-semibold">Textures et morceaux</h2>
    </div>
    <Card class="overflow-hidden">
      <ul class="divide-y">
        {#each TEXTURE_PROGRESSION as t, i (i)}
          <li class="grid gap-2 p-4 md:grid-cols-[80px_1fr]">
            <div class="text-sm font-semibold text-primary">~ {t.ageMonths} mois</div>
            <div>
              <p class="text-sm font-medium">{t.texture}</p>
              {#if t.examples.length > 0}
                <p class="mt-1 text-xs text-muted-foreground">
                  <span class="font-medium text-foreground/80">Exemples :</span>
                  {t.examples.join(', ')}
                </p>
              {/if}
              {#if t.markers.length > 0}
                <p class="mt-1 text-xs text-muted-foreground">
                  <span class="font-medium text-foreground/80">Signes de progression :</span>
                  {t.markers.join(' · ')}
                </p>
              {/if}
            </div>
          </li>
        {/each}
      </ul>
    </Card>

    <Card class="border-reaction-inconfort/30 bg-reaction-inconfort/5 p-4">
      <h3 class="flex items-center gap-2 text-sm font-semibold text-reaction-inconfort">
        <AlertTriangle size={14} aria-hidden="true" />
        Étouffement : règles de découpe
      </h3>
      <ul class="mt-2 grid gap-1 text-sm text-foreground/90 sm:grid-cols-2">
        {#each CHOKING_HAZARDS as c, i (i)}
          <li><strong>{c.food}</strong> — {c.rule}</li>
        {/each}
      </ul>
      <p class="mt-3 text-xs text-muted-foreground">
        Bébé mange toujours <strong>assis bien droit</strong>, dans une chaise haute adaptée,
        <strong>jamais seul</strong>, jamais en voiture, ni en poussette, ni allongé.
      </p>
    </Card>
  </section>

  <!-- 7. Forbidden foods -->
  <section id="eviter" class="scroll-mt-6 space-y-3">
    <div class="flex items-center gap-2">
      <AlertTriangle size={18} class="text-reaction-inconfort" aria-hidden="true" />
      <h2 class="text-xl font-semibold">Aliments à éviter</h2>
    </div>
    <Card class="overflow-hidden">
      <ul class="divide-y">
        {#each FORBIDDEN_FOODS as f (f.id)}
          <li class="grid gap-1 p-4 md:grid-cols-[1fr_auto]">
            <div>
              <h3 class="text-sm font-semibold">{f.name}</h3>
              <p class="mt-1 text-sm text-foreground/90">{f.reason}</p>
              <div class="mt-1.5">
                <SourceCitation ids={[...f.sources]} inline />
              </div>
            </div>
            <Badge variant="inconfort" class="self-start whitespace-nowrap">{f.until}</Badge>
          </li>
        {/each}
      </ul>
    </Card>
  </section>

  <!-- 8. Reactions -->
  <section id="reactions" class="scroll-mt-6 space-y-3">
    <div class="flex items-center gap-2">
      <HeartPulse size={18} class="text-primary" aria-hidden="true" />
      <h2 class="text-xl font-semibold">Réactions et urgences</h2>
    </div>
    <div class="grid gap-3 md:grid-cols-2">
      {#each REACTION_GUIDANCE as r (r.level)}
        <Card class={r.level === 'reaction' ? 'border-reaction-reaction/30 bg-reaction-reaction/5 p-4' : 'p-4'}>
          <h3 class="text-sm font-semibold">{r.title}</h3>
          <h4 class="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Signes
          </h4>
          <ul class="mt-1 list-disc space-y-1 pl-5 text-sm text-foreground/90">
            {#each r.signs as s, i (i)}
              <li>{s}</li>
            {/each}
          </ul>
          <h4 class="mt-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            Conduite à tenir
          </h4>
          <p class="mt-1 text-sm text-foreground/90">{r.whatToDo}</p>
        </Card>
      {/each}
    </div>
    <Card class="border-reaction-reaction/40 bg-reaction-reaction/10 p-4">
      <div class="flex items-center gap-3">
        <div class="flex h-10 w-10 items-center justify-center rounded-full bg-reaction-reaction text-white">
          <Phone size={18} aria-hidden="true" />
        </div>
        <div>
          <h3 class="text-base font-semibold text-reaction-reaction">
            Urgence : appeler le {EMERGENCY_NUMBER}
          </h3>
          <p class="text-sm text-foreground/90">
            Œdème de la gorge ou des lèvres, gêne respiratoire, vomissements répétés, perte de
            tonus, urticaire généralisée → SAMU sans délai.
          </p>
        </div>
      </div>
    </Card>
  </section>

  <!-- 9. Approaches -->
  <section id="approches" class="scroll-mt-6 space-y-3">
    <div class="flex items-center gap-2">
      <Users size={18} class="text-primary" aria-hidden="true" />
      <h2 class="text-xl font-semibold">Classique, DME, mixte</h2>
    </div>
    <div class="grid gap-3 md:grid-cols-3">
      {#each Object.entries(APPROACHES) as [key, a] (key)}
        <Card class="p-4">
          <h3 class="text-sm font-semibold">{a.title}</h3>
          <p class="mt-1 text-sm text-foreground/90">{a.body}</p>
          <h4 class="mt-2 text-[11px] font-semibold uppercase tracking-wider text-reaction-ras">
            Avantages
          </h4>
          <ul class="mt-1 list-disc space-y-0.5 pl-5 text-sm">
            {#each a.pros as p, i (i)}
              <li>{p}</li>
            {/each}
          </ul>
          <h4 class="mt-2 text-[11px] font-semibold uppercase tracking-wider text-reaction-inconfort">
            Limites
          </h4>
          <ul class="mt-1 list-disc space-y-0.5 pl-5 text-sm">
            {#each a.cons as p, i (i)}
              <li>{p}</li>
            {/each}
          </ul>
          <div class="mt-2">
            <SourceCitation ids={[...a.sources]} inline />
          </div>
        </Card>
      {/each}
    </div>
  </section>

  <!-- 10. Sources -->
  <section id="sources" class="scroll-mt-6 space-y-3">
    <div class="flex items-center gap-2">
      <Library size={18} class="text-primary" aria-hidden="true" />
      <h2 class="text-xl font-semibold">Sources et références</h2>
    </div>
    <Card class="p-4">
      <p class="text-sm text-foreground/90">
        Toutes les recommandations affichées dans Diversif s'appuient sur des sources publiques
        et vérifiables — institutionnelles (HCSP, Santé publique France, ANSES, OMS), sociétés
        savantes (ESPGHAN, Société Française de Pédiatrie) et études cliniques de référence
        (LEAP, EAT). En cas de doute, consultez votre pédiatre.
      </p>
      <ul class="mt-3 space-y-2">
        {#each allSourceIds as id (id)}
          {@const s = SOURCES[id]}
          <li class="rounded-md border bg-background p-3">
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              class="inline-flex items-start gap-1.5 text-sm font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 rounded"
            >
              <span>{s.label}</span>
              <ExternalLink size={12} class="mt-1 shrink-0" aria-hidden="true" />
            </a>
            <div class="mt-0.5 text-xs text-muted-foreground">{s.org} · {s.year}</div>
          </li>
        {/each}
      </ul>
    </Card>

    <p class="text-center text-xs text-muted-foreground">
      Diversif n'est pas un avis médical individuel. En cas de doute sur l'introduction d'un
      aliment, demandez conseil à votre pédiatre ou à un allergologue.
    </p>
  </section>

  <div class="pt-2 text-center">
    <Button href={`/child/${data.child.id}`} variant="ghost">← Retour au tableau</Button>
  </div>
</div>

<AllergenInfoDialog bind:allergenId={openAllergenId} />
