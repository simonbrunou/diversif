<script lang="ts">
  import Card from '#lib/components/ui/Card.svelte';
  import SourceCitation from '#lib/components/SourceCitation.svelte';
  import EmphasisText from '#lib/components/EmphasisText.svelte';
  import { REACTION_GUIDANCE, EMERGENCY_NUMBER } from '#lib/content/guidance.js';
  import { HeartPulse, Phone } from '@lucide/svelte';

  // The reaction card is a tint: it sets the tint's own foreground and its
  // text inherits it (DESIGN.md, The Paired Foreground Rule). The other cards
  // sit on the plain card and keep grey eyebrows over near-ink text.
  const TINTED = { eyebrow: '', body: '', sources: 'text-current' };
  const PLAIN = { eyebrow: 'text-muted-foreground', body: 'text-foreground/90', sources: '' };
</script>

<section id="reactions" class="scroll-mt-6 space-y-3">
  <div class="flex items-center gap-2">
    <HeartPulse size={18} class="text-primary" aria-hidden="true" />
    <h2 class="text-xl font-semibold">Réactions et urgences</h2>
  </div>
  <div class="grid gap-3 md:grid-cols-2">
    {#each REACTION_GUIDANCE as r (r.level)}
      {@const tone = r.level === 'reaction' ? TINTED : PLAIN}
      <Card
        class={r.level === 'reaction'
          ? 'border-reaction-reaction/30 bg-reaction-reaction/5 p-4 text-reaction-reaction-foreground'
          : 'p-4'}
      >
        <h3 class="text-sm font-semibold">{r.title}</h3>
        <h4 class="mt-2 text-2xs font-semibold uppercase tracking-wider {tone.eyebrow}">Signes</h4>
        <ul class="mt-1 list-disc space-y-1 pl-5 text-sm {tone.body}">
          {#each r.signs as s, i (i)}
            <li>{s}</li>
          {/each}
        </ul>
        <h4 class="mt-2 text-2xs font-semibold uppercase tracking-wider {tone.eyebrow}">
          Conduite à tenir
        </h4>
        <p class="mt-1 text-sm {tone.body}"><EmphasisText text={r.whatToDo} /></p>
        <div class="mt-2">
          <SourceCitation ids={r.sources} inline class={tone.sources} /><!-- paired-foreground-ok: text-current on the tinted card, which the component test checks -->
        </div>
      </Card>
    {/each}
  </div>
  <Card
    class="border-reaction-reaction/40 bg-reaction-reaction/10 p-4 text-reaction-reaction-foreground"
  >
    <div class="flex items-center gap-3">
      <div
        class="flex h-10 w-10 items-center justify-center rounded-full bg-reaction-reaction text-reaction-reaction-foreground"
      >
        <Phone size={18} aria-hidden="true" />
      </div>
      <div>
        <h3 class="text-base font-semibold">
          Urgence : appeler le {EMERGENCY_NUMBER}
        </h3>
        <p class="text-sm">
          Gêne respiratoire, œdème des lèvres ou de la langue, malaise ou plusieurs symptômes
          associés → appel sans délai.
        </p>
      </div>
    </div>
  </Card>
</section>
