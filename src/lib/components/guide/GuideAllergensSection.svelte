<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Badge from '$components/ui/Badge.svelte';
  import SourceCitation from '$lib/components/SourceCitation.svelte';
  import AllergenInfoDialog from '$lib/components/AllergenInfoDialog.svelte';
  import { ALLERGENS, type AllergenId } from '$lib/utils/allergens';
  import { ALLERGEN_GUIDANCE } from '$lib/content/guidance';
  import { ShieldCheck } from 'lucide-svelte';

  let openAllergenId = $state<AllergenId | null>(null);
</script>

<section id="allergenes" class="scroll-mt-6 space-y-3">
  <div class="flex items-center gap-2">
    <ShieldCheck size={18} class="text-primary" aria-hidden="true" />
    <h2 class="text-xl font-semibold">Les 12 allergènes majeurs</h2>
  </div>
  <Card class="p-4 md:p-5">
    <p class="text-sm text-foreground/90">
      Les recommandations actuelles sont claires : <strong
        >ne plus retarder l'introduction</strong
      >
      des allergènes prioritaires (œuf, arachide, lait, gluten, poisson, fruits à coque, sésame). La
      fenêtre 4–11 mois est clé pour réduire le risque d'allergie.
    </p>
    <p class="mt-2 text-sm text-foreground/90">
      L'étude <strong>LEAP</strong> a montré que l'introduction précoce de l'arachide réduisait de
      86 % le risque d'allergie chez les nourrissons à risque. L'étude
      <strong>EAT</strong>, portant sur 6 allergènes (arachide, œuf, lait, sésame, poisson, blé)
      introduits dès 3–4 mois, a divisé par 3 la prévalence d'allergies alimentaires.
    </p>
    <p class="mt-2 text-sm text-foreground/90">
      <strong>Cas particuliers.</strong> Le <strong>soja</strong> est tracé ici pour le suivi mais HCSP
      2020 et ANSES déconseillent les produits à base de soja avant 3 ans (phyto-œstrogènes). Les
      <strong>crustacés, mollusques, céleri et moutarde</strong> figurent dans la liste pour la complétude
      (règlement UE 1169/2011), sans recommandation d'introduction précoce spécifique.
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

<AllergenInfoDialog bind:allergenId={openAllergenId} />
