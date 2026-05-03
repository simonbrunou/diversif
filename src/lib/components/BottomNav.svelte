<script lang="ts">
  import { page } from '$app/stores';
  import { cn } from '$lib/utils/cn';

  let { childId }: { childId: number } = $props();

  type NavItem = {
    href: string;
    label: string;
    icon: string;
  };

  const items = $derived<NavItem[]>([
    { href: `/child/${childId}`, label: 'Tableau', icon: 'home' },
    { href: `/child/${childId}/foods`, label: 'Aliments', icon: 'list' },
    { href: `/child/${childId}/log`, label: 'Logguer', icon: 'plus' },
    { href: `/child/${childId}/allergens`, label: 'Allergènes', icon: 'shield' },
    { href: `/child/${childId}/suggestions`, label: 'Idées', icon: 'sparkle' }
  ]);

  function isActive(href: string): boolean {
    const path = $page.url.pathname;
    if (href === `/child/${childId}`) return path === href;
    return path.startsWith(href);
  }
</script>

<nav
  class="safe-bottom sticky bottom-0 z-30 mt-auto border-t bg-background/95 backdrop-blur md:hidden"
>
  <ul class="grid grid-cols-5 gap-1 px-2 pt-2">
    {#each items as item (item.href)}
      <li>
        <a
          href={item.href}
          class={cn(
            'flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[11px] transition-colors',
            isActive(item.href)
              ? 'text-primary'
              : 'text-muted-foreground hover:text-foreground'
          )}
        >
          <span class="flex h-6 w-6 items-center justify-center" aria-hidden="true">
            {#if item.icon === 'home'}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 11 12 4l9 7v9a2 2 0 0 1-2 2h-4v-6h-6v6H5a2 2 0 0 1-2-2v-9Z"/></svg>
            {:else if item.icon === 'list'}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>
            {:else if item.icon === 'plus'}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="16"/><line x1="8" y1="12" x2="16" y2="12"/></svg>
            {:else if item.icon === 'shield'}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z"/></svg>
            {:else if item.icon === 'sparkle'}
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/></svg>
            {/if}
          </span>
          <span>{item.label}</span>
        </a>
      </li>
    {/each}
  </ul>
</nav>
