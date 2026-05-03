<script lang="ts">
  import Button from '$components/ui/Button.svelte';
</script>

<section class="border-b bg-gradient-to-b from-primary/5 via-surface to-background">
  <div class="container max-w-4xl py-12 text-center md:py-20">
    <p class="text-xs font-semibold uppercase tracking-wider text-primary">
      Diversification alimentaire de 4 mois à 3 ans
    </p>
    <h1 class="mt-3 text-3xl font-semibold leading-tight md:text-5xl">
      Diversifier en confiance, sans douter.
    </h1>
    <p class="mx-auto mt-4 max-w-2xl text-base text-muted-foreground md:text-lg">
      Diversif vous accompagne pour introduire les bons aliments au bon moment, suivre les 12
      allergènes prioritaires et partager le suivi avec l'autre parent — adossé aux
      recommandations HCSP, Santé publique France et ESPGHAN.
    </p>
    <div class="mt-7 flex flex-wrap justify-center gap-3">
      <Button href="/signup" size="lg">Créer mon compte gratuit</Button>
      <Button href="/guide" size="lg" variant="outline">Lire le guide</Button>
    </div>
    <p class="mt-4 text-sm text-muted-foreground">
      Déjà un compte ?
      <a href="/login" class="font-medium text-foreground underline-offset-4 hover:underline">
        Se connecter
      </a>
    </p>
    <p class="mt-6 text-xs text-muted-foreground">
      Self-hosted · Données chez vous · Sans publicité · Open source
    </p>
  </div>
</section>
