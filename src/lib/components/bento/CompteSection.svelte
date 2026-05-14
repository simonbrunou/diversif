<script lang="ts">
  import SectionHeader from '$components/ui/SectionHeader.svelte';
  import * as m from '$lib/paraglide/messages';
  import { ChevronRight, KeyRound, Languages, Moon, Lock } from 'lucide-svelte';

  let {
    passkeyCount,
    locale,
    theme
  }: { passkeyCount: number; locale: 'fr' | 'en'; theme: 'system' | 'light' | 'dark' } = $props();

  const passkeyMeta = $derived(
    passkeyCount === 1
      ? m.profilComptePasskeysDeviceSingular()
      : m.profilComptePasskeysDevicesPlural({ count: String(passkeyCount) })
  );

  const rows = $derived([
    {
      key: 'passkeys',
      icon: KeyRound,
      label: m.profilComptePasskeys(),
      meta: passkeyMeta,
      href: '/account#passkeys'
    },
    {
      key: 'langue',
      icon: Languages,
      label: m.profilCompteLangue(),
      meta: locale.toUpperCase(),
      href: '/account#locale'
    },
    {
      key: 'theme',
      icon: Moon,
      label: m.profilCompteTheme(),
      meta: theme,
      href: '/account#theme'
    },
    {
      key: 'password',
      icon: Lock,
      label: m.profilComptePassword(),
      meta: '',
      href: '/account#password'
    }
  ]);
</script>

<section class="mb-3">
  <SectionHeader>{m.profilCompteTitle()}</SectionHeader>
  <ul class="flex flex-col gap-2">
    {#each rows as row (row.key)}
      <li>
        <a
          href={row.href}
          class="flex items-center gap-3 rounded-tile bg-surface px-3 py-3 shadow-soft transition-transform duration-base ease-soft active:scale-[0.99] motion-reduce:transform-none motion-reduce:transition-none"
        >
          <row.icon size={18} class="text-ink-soft" aria-hidden="true" />
          <span class="flex-1 text-sm font-bold">{row.label}</span>
          {#if row.meta}
            <span class="text-xs text-ink-soft">{row.meta}</span>
          {/if}
          <ChevronRight size={16} class="text-ink-soft" aria-hidden="true" />
        </a>
      </li>
    {/each}
  </ul>
</section>
