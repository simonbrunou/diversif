<script lang="ts" module>
  import { Calendar, BookText, Sparkles, User } from 'lucide-svelte';

  type Tab = {
    href: (childId: string) => string;
    labelKey: 'chromeTabsAujourdhui' | 'chromeTabsCarnet' | 'chromeTabsDecouvrir' | 'chromeTabsProfil';
    matcher: (path: string) => boolean;
    icon: typeof Calendar;
  };

  export const TABS: Tab[] = [
    {
      href: (id) => `/child/${id}`,
      labelKey: 'chromeTabsAujourdhui',
      matcher: (p) => /^\/child\/[^/]+$/.test(p),
      icon: Calendar
    },
    {
      href: (id) => `/child/${id}/foods`,
      labelKey: 'chromeTabsCarnet',
      matcher: (p) => /^\/child\/[^/]+\/(foods|allergens|analytics)/.test(p),
      icon: BookText
    },
    {
      href: (id) => `/child/${id}/guide`,
      labelKey: 'chromeTabsDecouvrir',
      matcher: (p) => /^\/child\/[^/]+\/(guide|suggestions)/.test(p) || p === '/sources',
      icon: Sparkles
    },
    {
      href: () => `/account`,
      labelKey: 'chromeTabsProfil',
      matcher: (p) =>
        p.startsWith('/account') ||
        p.startsWith('/passkeys') ||
        p === '/cgu' ||
        p === '/mentions-legales' ||
        p === '/politique-confidentialite' ||
        p === '/cookies',
      icon: User
    }
  ];
</script>

<script lang="ts">
  import * as m from '$lib/paraglide/messages';
  import { cn } from '$lib/utils/cn';

  let {
    currentChildId,
    currentPath
  }: { currentChildId: string; currentPath: string } = $props();
</script>

<nav
  aria-label={m.chromeBottomNavLabel()}
  class="fixed bottom-[calc(0.75rem+env(safe-area-inset-bottom))] left-3 right-3 z-30 flex h-14 items-center rounded-full border border-border/40 bg-surface/95 px-2 shadow-soft backdrop-blur"
>
  {#each TABS as tab, i (tab.labelKey)}
    {@const active = tab.matcher(currentPath)}
    <a
      href={tab.href(currentChildId)}
      aria-current={active ? 'page' : undefined}
      class={cn(
        'flex flex-1 flex-col items-center gap-0.5 text-[11px] font-medium transition-colors duration-base ease-soft',
        active ? 'text-primary-strong' : 'text-foreground/70 hover:text-foreground'
      )}
    >
      <tab.icon size={18} aria-hidden="true" />
      <span>{m[tab.labelKey]()}</span>
    </a>
    {#if i === 1}
      <!-- spacer for FAB -->
      <div class="w-16" aria-hidden="true"></div>
    {/if}
  {/each}
</nav>
