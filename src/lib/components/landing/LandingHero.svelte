<script lang="ts">
  import Button from '$components/ui/Button.svelte';
</script>

<section
  class="relative overflow-hidden bg-gradient-to-br from-accent-peach/35 via-accent-butter/25 to-accent-mint/25 dark:from-accent-peach/10 dark:via-accent-butter/5 dark:to-accent-mint/10"
>
  <div
    aria-hidden="true"
    class="pointer-events-none absolute -left-24 -top-24 h-72 w-72 rounded-full bg-accent-butter/40 blur-3xl dark:bg-accent-butter/15"
  ></div>
  <div
    aria-hidden="true"
    class="pointer-events-none absolute -right-24 top-12 h-80 w-80 rounded-full bg-accent-peach/40 blur-3xl dark:bg-accent-peach/15"
  ></div>
  <div
    aria-hidden="true"
    class="pointer-events-none absolute -bottom-32 left-1/3 h-72 w-72 rounded-full bg-accent-mint/40 blur-3xl dark:bg-accent-mint/15"
  ></div>

  <div class="container relative max-w-4xl py-12 text-center md:py-20">
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

  <svg
    aria-hidden="true"
    class="block w-full text-background"
    viewBox="0 0 1440 80"
    preserveAspectRatio="none"
  >
    <path
      fill="currentColor"
      d="M0,48 C240,80 480,0 720,32 C960,64 1200,16 1440,48 L1440,80 L0,80 Z"
    />
  </svg>
</section>
