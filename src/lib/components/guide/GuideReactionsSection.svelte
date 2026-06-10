<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import { REACTION_GUIDANCE, EMERGENCY_NUMBER } from '$lib/content/guidance';
  import { HeartPulse, Phone } from 'lucide-svelte';
</script>

<section id="reactions" class="scroll-mt-6 space-y-3">
  <div class="flex items-center gap-2">
    <HeartPulse size={18} class="text-primary" aria-hidden="true" />
    <h2 class="text-xl font-semibold">Réactions et urgences</h2>
  </div>
  <div class="grid gap-3 md:grid-cols-2">
    {#each REACTION_GUIDANCE as r (r.level)}
      <Card
        class={r.level === 'reaction'
          ? 'border-reaction-reaction/30 bg-reaction-reaction/5 p-4'
          : 'p-4'}
      >
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
      <div
        class="flex h-10 w-10 items-center justify-center rounded-full bg-reaction-reaction text-reaction-reaction-foreground"
      >
        <Phone size={18} aria-hidden="true" />
      </div>
      <div>
        <h3 class="text-base font-semibold text-reaction-reaction-foreground">
          Urgence : appeler le {EMERGENCY_NUMBER}
        </h3>
        <p class="text-sm text-foreground/90">
          Œdème de la gorge ou des lèvres, gêne respiratoire, vomissements répétés, perte de tonus,
          urticaire généralisée → SAMU sans délai.
        </p>
      </div>
    </div>
  </Card>
</section>
