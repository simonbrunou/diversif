<script lang="ts">
  import ChildCardRow from './ChildCardRow.svelte';
  import CoparentsSection from './CoparentsSection.svelte';
  import CompteSection from './CompteSection.svelte';
  import RgpdSection from './RgpdSection.svelte';
  import DashedActionRow from '$components/ui/DashedActionRow.svelte';
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';
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
  <section class="mb-3">
    <SectionHeader>{m.profilChildrenTitle()}</SectionHeader>
    {#each children as child (child.id)}
      <ChildCardRow {child} href={localizedHref(`/child/${child.id}/settings`)} />
    {/each}
    <DashedActionRow
      href={localizedHref('/child/new')}
      icon={Plus}
      iconSize={18}
      class="flex px-4 py-3"
    >
      {m.profilChildrenAdd()}
    </DashedActionRow>
  </section>

  {#each children as child (child.id)}
    <CoparentsSection
      childName={child.name}
      coparents={child.coparents}
      inviteHref={localizedHref(`/child/${child.id}/settings#invite`)}
    />
  {/each}

  <CompteSection {passkeyCount} {locale} {theme} />
  <RgpdSection />

  <section class="mb-3">
    <SectionHeader>{m.profilLegalTitle()}</SectionHeader>
    <ul class="flex flex-wrap gap-x-4 gap-y-1 text-sm text-primary-strong">
      <li><a href={localizedHref('/aide')} class="underline">{m.aideNavLabel()}</a></li>
      <li><a href={localizedHref('/cgu')} class="underline">{m.chromePublicFooterCGU()}</a></li>
      <li><a href={localizedHref('/mentions-legales')} class="underline">{m.chromeLegalLinksMentionsLegales()}</a></li>
      <li><a href={localizedHref('/politique-confidentialite')} class="underline">{m.chromeLegalLinksPolitiqueConfidentialite()}</a></li>
      <li><a href={localizedHref('/cookies')} class="underline">{m.chromeLegalLinksCookies()}</a></li>
    </ul>
  </section>
</div>
