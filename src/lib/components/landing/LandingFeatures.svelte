<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import { Compass, ShieldCheck, Users, Library } from 'lucide-svelte';

  const features = [
    {
      icon: Compass,
      title: 'Une étape claire, à chaque âge',
      body: "Quatre étapes balisées entre 4 mois et 3 ans : ce qu'on propose, les textures, le lait, les signes à surveiller. Vous savez toujours où en est bébé."
    },
    {
      icon: ShieldCheck,
      title: 'Les 12 allergènes, sans peur',
      body: "Suivi de l'introduction des 12 allergènes prioritaires. La fenêtre 4–11 mois est déterminante : LEAP et EAT montrent que l'introduction précoce divise par 3 le risque d'allergie."
    },
    {
      icon: Users,
      title: 'À deux, sur le même tableau',
      body: "Partagez le suivi avec l'autre parent ou la nounou via un code d'invitation. Tout le monde voit les mêmes repas, les mêmes réactions, la même progression."
    },
    {
      icon: Library,
      title: 'Toujours sourcé',
      body: 'Chaque conseil renvoie à sa source : HCSP, Santé publique France, ANSES, ESPGHAN, OMS, SFP, études LEAP et EAT. Aucun avis personnel, que des références.'
    }
  ] as const;
</script>

<section class="container max-w-5xl py-12 md:py-16">
  <h2 class="text-center text-2xl font-semibold md:text-3xl">Ce que Diversif fait pour vous</h2>
  <p class="mx-auto mt-2 max-w-2xl text-center text-sm text-muted-foreground">
    Un outil simple pour démarrer la diversification, suivre les allergènes et garder tout le
    monde sur la même page.
  </p>
  <div class="mt-8 grid gap-4 sm:grid-cols-2">
    {#each features as f (f.title)}
      {@const Icon = f.icon}
      <Card class="p-5">
        <div class="flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary">
          <Icon size={20} aria-hidden="true" />
        </div>
        <h3 class="mt-3 text-base font-semibold">{f.title}</h3>
        <p class="mt-1 text-sm text-foreground/90">{f.body}</p>
      </Card>
    {/each}
  </div>
</section>
