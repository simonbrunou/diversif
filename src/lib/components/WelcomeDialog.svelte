<script lang="ts">
  import Dialog from '$components/ui/Dialog.svelte';
  import Button from '$components/ui/Button.svelte';
  import { enhance } from '$app/forms';
  import { Heart, Sparkles, BookOpen } from 'lucide-svelte';

  let {
    open = $bindable(false),
    childId,
    formAction
  }: { open?: boolean; childId: number; formAction: string } = $props();

  let step = $state(0);

  function next() {
    step += 1;
  }

  function close() {
    open = false;
    step = 0;
  }
</script>

<Dialog bind:open onclose={close} class="max-w-md">
  <div class="space-y-3 text-sm">
    {#if step === 0}
      <div class="flex items-center gap-2">
        <Heart size={20} class="text-primary" aria-hidden="true" />
        <h2 class="text-lg font-semibold">Bienvenue dans la diversification</h2>
      </div>
      <p class="text-foreground/90">
        Diversif vous aide à introduire les aliments en toute sérénité, à suivre les
        allergènes et à varier les goûts.
      </p>
      <ul class="list-disc space-y-1.5 pl-5 text-foreground/90">
        <li>
          On démarre <strong>entre 4 mois révolus et 6 mois</strong>, dès que bébé tient sa tête et
          montre de l'intérêt pour le repas.
        </li>
        <li>
          On <strong>introduit les allergènes tôt</strong> (œuf, arachide en purée, lait, gluten…) :
          ça réduit le risque d'allergie.
        </li>
        <li>
          On <strong>repropose un aliment refusé jusqu'à 10 fois</strong> — l'acceptation se
          construit, sans forcer.
        </li>
      </ul>
    {:else if step === 1}
      <div class="flex items-center gap-2">
        <Sparkles size={20} class="text-primary" aria-hidden="true" />
        <h2 class="text-lg font-semibold">Comment Diversif vous accompagne</h2>
      </div>
      <ul class="list-disc space-y-1.5 pl-5 text-foreground/90">
        <li><strong>Logguer</strong> : enregistrez chaque aliment donné et la réaction observée.</li>
        <li>
          <strong>Suivi des allergènes</strong> : visualisez les 12 allergènes majeurs et leur
          progression.
        </li>
        <li><strong>Suggestions</strong> : des aliments à introduire bientôt selon l'âge.</li>
        <li><strong>Guide</strong> : étapes, allergènes, textures, sources officielles.</li>
        <li><strong>Rappels</strong> : nudges intelligents quand un aliment ou un allergène traîne.</li>
      </ul>
    {:else}
      <div class="flex items-center gap-2">
        <BookOpen size={20} class="text-primary" aria-hidden="true" />
        <h2 class="text-lg font-semibold">Prêt·e à explorer</h2>
      </div>
      <p class="text-foreground/90">
        Le guide rassemble tout ce qu'il faut savoir : règles d'or, aliments par étape,
        allergènes en détail, aliments interdits, sécurité, sources officielles
        (Santé publique France, HCSP, ESPGHAN, études LEAP &amp; EAT).
      </p>
      <p class="text-foreground/90">
        Vous pouvez l'ouvrir à tout moment depuis le menu « Guide ».
      </p>
    {/if}
  </div>

  {#snippet footer()}
    <form method="POST" action={formAction} use:enhance={() => () => close()}>
      <input type="hidden" name="reminderKey" value="welcome-dialog" />
      <Button variant="ghost" type="submit">Plus tard</Button>
    </form>
    {#if step < 2}
      <Button onclick={next}>Suivant</Button>
    {:else}
      <Button href={`/child/${childId}/guide`}>Ouvrir le guide</Button>
    {/if}
  {/snippet}
</Dialog>
