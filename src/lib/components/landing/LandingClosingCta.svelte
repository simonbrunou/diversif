<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import { localizedHref } from '$lib/utils/localized-href';
</script>

<section class="container max-w-3xl py-12 md:py-16">
  <div class="rounded-2xl border bg-gradient-to-br from-primary/10 to-accent/40 p-8 text-center md:p-12">
    <h2 class="text-2xl font-semibold md:text-3xl">Prêt·e à diversifier sereinement ?</h2>
    <p class="mx-auto mt-2 max-w-xl text-sm text-foreground/90 md:text-base">
      Créez un compte en 30 secondes, ajoutez bébé, et commencez à logguer dès le premier repas.
    </p>
    <div class="mt-6 flex flex-wrap justify-center gap-3">
      <Button href={localizedHref('/signup')} size="lg">Créer mon compte</Button>
      <Button href={localizedHref('/guide')} size="lg" variant="outline">Lire le guide d'abord</Button>
    </div>
    <p class="mt-6 text-xs text-muted-foreground">
      Diversif n'est pas un avis médical individuel. En cas de doute, consultez votre pédiatre.
    </p>
  </div>
</section>
