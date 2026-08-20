<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Badge from '$components/ui/Badge.svelte';
  import SourceCitation from '$lib/components/SourceCitation.svelte';
  import AllergenInfoDialog from '$lib/components/AllergenInfoDialog.svelte';
  import { ALLERGENS, getAllergenLabel, type AllergenId } from '$lib/utils/allergens';
  import { ALLERGEN_GUIDANCE } from '$lib/content/guidance';
  import { ShieldCheck } from 'lucide-svelte';

  let openAllergenId = $state<AllergenId | null>(null);
</script>

<section id="allergenes" class="scroll-mt-6 space-y-3">
  <div class="flex items-center gap-2">
    <ShieldCheck size={18} class="text-primary" aria-hidden="true" />
    <h2 class="text-xl font-semibold">Les 12 allergènes suivis</h2>
  </div>
  <Card class="p-4 md:p-5">
    <p class="text-sm text-foreground/90">
      Les recommandations actuelles sont claires : <strong
        >ne plus retarder l'introduction</strong
      >
      des allergènes une fois la diversification commencée entre 4 et 6 mois. L’effet préventif
      est surtout démontré pour l’œuf bien cuit et l’arachide.
    </p>
    <p class="mt-2 text-sm text-foreground/90">
      Dans l’étude <strong>LEAP</strong>, l’introduction précoce de l’arachide a réduit le risque
      jusqu’à 86 % dans un sous-groupe de nourrissons à haut risque. Dans <strong>EAT</strong>,
      l’analyse principale n’était pas significative ; un bénéfice a été observé chez les enfants
      ayant suivi le protocole.
    </p>
    <p class="mt-2 text-sm text-foreground/90">
      <strong>Cas particuliers.</strong> Le <strong>soja</strong> est tracé ici pour le suivi mais HCSP
      2020 et ANSES déconseillent les produits à base de soja avant 3 ans (phyto-œstrogènes). Les
      <strong>crustacés, mollusques, céleri et moutarde</strong> figurent dans la liste pour la complétude
      (règlement UE 1169/2011), sans recommandation d'introduction précoce spécifique.
    </p>
    <div class="mt-3">
      <SourceCitation ids={['hcsp-2020', 'eaaci-2020', 'leap-2015', 'eat-2016', 'eu-1169-2011']} inline />
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
          <span class="font-medium">{getAllergenLabel(a.id)}</span>
            <Badge variant="default" class="shrink-0 text-3xs">
              {g.timing}
          </Badge>
        </div>
        <p class="mt-1 line-clamp-2 text-xs text-muted-foreground">{g.why}</p>
      </button>
    {/each}
  </div>
</section>

<AllergenInfoDialog bind:allergenId={openAllergenId} />
