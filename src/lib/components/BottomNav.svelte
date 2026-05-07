<script lang="ts">
  import { page } from '$app/stores';
  import { cn } from '$lib/utils/cn';
  import { getChildNavItems, isNavItemActive } from '$lib/utils/nav';
  import * as m from '$lib/paraglide/messages';
  import { i18n } from '$lib/i18n';
  import { languageTag } from '$lib/paraglide/runtime';

  let { childId }: { childId: number } = $props();

  function localizedHref(path: string): string {
    return i18n.resolveRoute(path, languageTag());
  }

  const items = $derived(getChildNavItems(childId));
  // Strip the /en prefix so isNavItemActive (which compares against unprefixed
  // item.href values) still highlights the correct tab on English child routes.
  const pathname = $derived($page.url.pathname.replace(/^\/en(?=\/|$)/, '') || '/');
</script>

<nav
  class="safe-bottom sticky bottom-0 z-30 mt-auto border-t bg-background/95 backdrop-blur print:hidden md:hidden"
  aria-label={m.chromeBottomNavLabel()}
>
  <ul class="grid grid-cols-5 gap-1 px-2 pt-2">
    {#each items as item (item.href)}
      {@const active = isNavItemActive(item.href, pathname, childId)}
      {@const Icon = item.icon}
      <li>
        <a
          href={localizedHref(item.href)}
          class={cn(
            'flex flex-col items-center gap-0.5 rounded-md px-1 py-1.5 text-[11px] font-medium transition-colors',
            'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
            active ? 'text-primary' : 'text-muted-foreground hover:text-foreground'
          )}
          aria-current={active ? 'page' : undefined}
        >
          <span
            class={cn(
              'flex h-7 w-7 items-center justify-center rounded-full transition-colors',
              item.primary && 'bg-primary text-primary-foreground shadow-card',
              active && !item.primary && 'bg-primary/10'
            )}
            aria-hidden="true"
          >
            <Icon size={item.primary ? 20 : 18} strokeWidth={item.primary ? 2.5 : 2} />
          </span>
          <span>{item.label}</span>
        </a>
      </li>
    {/each}
  </ul>
</nav>
