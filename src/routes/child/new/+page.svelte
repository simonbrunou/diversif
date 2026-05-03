<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import Card from '$components/ui/Card.svelte';
  import TipCard from '$lib/components/TipCard.svelte';
  import { Baby } from 'lucide-svelte';
  import type { ActionData } from './$types';

  let { form }: { form: ActionData } = $props();
</script>

<div class="container flex max-w-md flex-1 flex-col justify-center py-10">
  <div class="text-center">
    <h1 class="text-2xl font-semibold">Ajouter un enfant</h1>
    <p class="mt-2 text-sm text-muted-foreground">Pour suivre sa diversification.</p>
  </div>

  <div class="mt-6">
    <TipCard
      tone="info"
      icon={Baby}
      eyebrow="Diversification"
      body="On démarre entre 4 mois révolus et 6 mois, dès que bébé tient sa tête et montre de l'intérêt pour le repas. Tous les groupes (y compris les allergènes en formes adaptées) sont à introduire tôt — la fenêtre 4–11 mois est clé pour réduire le risque d'allergie."
      sources={['hcsp-2020', 'spf-pnns-guide', 'leap-2015']}
    />
  </div>

  <Card class="mt-6 p-6">
    <form method="POST" class="grid gap-4">
      {#if form?.error}
        <div class="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {form.error}
        </div>
      {/if}

      <div class="grid gap-1.5">
        <Label for="name">Prénom</Label>
        <Input id="name" name="name" required maxlength={80} value={form?.name ?? ''} />
      </div>

      <div class="grid gap-1.5">
        <Label for="birthDate">Date de naissance</Label>
        <Input id="birthDate" name="birthDate" type="date" required value={form?.birthDate ?? ''} />
      </div>

      <Button type="submit" size="lg">Créer</Button>
    </form>
  </Card>

  <div class="mt-4 text-center">
    <a href="/" class="text-sm text-muted-foreground hover:underline">Annuler</a>
  </div>
</div>
