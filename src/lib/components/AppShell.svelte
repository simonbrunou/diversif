<script lang="ts">
  import type { Snippet } from 'svelte';
  import LocaleSwitcher from './LocaleSwitcher.svelte';
  import { page } from '$app/stores';
  import { cn } from '$lib/utils/cn';
  import { getChildNavItems, isNavItemActive } from '$lib/utils/nav';
  import { formatAge } from '$lib/utils/age';
  import { UserCircle2 } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';

  let {
    childId,
    childName,
    birthDate,
    children
  }: {
    childId: number;
    childName: string;
    birthDate: string;
    children: Snippet;
  } = $props();

  const items = $derived(getChildNavItems(childId, { includeGuide: true }));
  const pathname = $derived($page.url.pathname);
</script>

<div class="flex flex-1">
  <aside
    class="hidden w-60 shrink-0 border-r bg-surface print:hidden md:sticky md:top-0 md:flex md:h-dvh md:flex-col"
  >
    <div class="border-b p-5">
      <a href="/" class="text-sm font-semibold tracking-tight text-primary hover:underline">
        Diversif
      </a>
      <div class="mt-3">
        <div class="truncate text-base font-semibold leading-tight">{childName}</div>
        <div class="text-xs text-muted-foreground">{formatAge(birthDate)}</div>
      </div>
    </div>
    <nav class="flex-1 overflow-y-auto p-3">
      <ul class="space-y-1">
        {#each items as item (item.href)}
          {@const active = isNavItemActive(item.href, pathname, childId)}
          {@const Icon = item.icon}
          <li>
            <a
              href={item.href}
              class={cn(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
                active
                  ? 'bg-accent text-accent-foreground'
                  : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
              )}
              aria-current={active ? 'page' : undefined}
            >
              <Icon size={18} aria-hidden="true" />
              <span>{item.label}</span>
            </a>
          </li>
        {/each}
      </ul>
    </nav>
    <div class="border-t p-3">
      <a
        href="/account"
        class={cn(
          'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring',
          pathname === '/account'
            ? 'bg-accent text-accent-foreground'
            : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground'
        )}
        aria-current={pathname === '/account' ? 'page' : undefined}
      >
        <UserCircle2 size={18} aria-hidden="true" />
        <span>{m.chromeAppShellMyAccount()}</span>
      </a>
      <div class="mt-2 flex justify-end">
        <LocaleSwitcher />
      </div>
    </div>
  </aside>

  <div class="flex min-w-0 flex-1 flex-col pb-20 md:pb-0">
    <main id="main" class="flex-1">
      {@render children()}
    </main>
  </div>
</div>
