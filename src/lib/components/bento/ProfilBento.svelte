<script lang="ts">
  import ChildCardRow from './ChildCardRow.svelte';
  import CoparentsSection from './CoparentsSection.svelte';
  import CompteSection from './CompteSection.svelte';
  import RgpdSection from './RgpdSection.svelte';
  import * as m from '$lib/paraglide/messages';
  import { Plus } from 'lucide-svelte';

  type ChildWithCoparents = {
    id: string;
    name: string;
    ageMonths: number;
    coparents: { id: string; displayName: string; role: string }[];
  };

  let {
    children,
    passkeyCount,
    locale,
    theme
  }: {
    children: ChildWithCoparents[];
    passkeyCount: number;
    locale: 'fr' | 'en';
    theme: 'system' | 'light' | 'dark';
  } = $props();
</script>

<div class="flex flex-col">
  <section class="mb-3" aria-label={m.profilChildrenTitle()}>
    <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
      {m.profilChildrenTitle()}
    </h2>
    {#each children as child (child.id)}
      <ChildCardRow {child} href={`/child/${child.id}/settings`} />
    {/each}
    <a
      href="/account#add-child"
      class="flex items-center gap-2 rounded-tile border border-dashed border-border bg-canvas px-4 py-3 text-sm font-semibold text-ink-soft transition-transform duration-base ease-soft active:scale-[0.99]"
    >
      <Plus size={18} aria-hidden="true" />
      {m.profilChildrenAdd()}
    </a>
  </section>

  {#each children as child (child.id)}
    <CoparentsSection
      childName={child.name}
      coparents={child.coparents}
      inviteHref={`/child/${child.id}/settings#invite`}
    />
  {/each}

  <CompteSection {passkeyCount} {locale} {theme} />
  <RgpdSection />

  <section class="mb-3" aria-label={m.profilLegalTitle()}>
    <h2 class="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-soft">
      {m.profilLegalTitle()}
    </h2>
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-primary">
      <li><a href="/cgu" class="underline">CGU</a></li>
      <li><a href="/mentions-legales" class="underline">Mentions légales</a></li>
      <li><a href="/politique-confidentialite" class="underline">Politique de confidentialité</a></li>
      <li><a href="/cookies" class="underline">Cookies</a></li>
    </ul>
  </section>
</div>
