<script lang="ts">
  import * as m from '$lib/paraglide/messages';

  const SOURCES = [
    { key: 'leap', label: 'LEAP' },
    { key: 'eat', label: 'EAT' },
    { key: 'espghan', label: 'ESPGHAN' },
    { key: 'anses', label: 'ANSES' },
    { key: 'hcsp', label: 'HCSP' }
  ] as const;
</script>

<section class="mb-3" aria-label={m.decouvrirSourcesTitle()}>
  <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
    {m.decouvrirSourcesTitle()}
  </h2>
  <div class="grid grid-cols-2 gap-2 sm:grid-cols-5">
    {#each SOURCES as src (src.key)}
      <a
        href={`/sources#${src.key}`}
        class="rounded-tile bg-tile-sky px-3 py-2 text-center text-sm font-semibold text-tile-sky-foreground shadow-soft transition-transform duration-base ease-soft hover:scale-[1.02] active:scale-[0.99]"
      >
        {src.label}
      </a>
    {/each}
  </div>
</section>
