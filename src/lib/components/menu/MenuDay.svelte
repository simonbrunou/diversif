<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Badge from '$components/ui/Badge.svelte';
  import Callout from '$components/ui/Callout.svelte';
  import type { Menu } from '$lib/server/menu/engine';
  import type { MealId, RoleId } from '$lib/server/menu/tables';
  import { getCategoryIcon, getCategoryClasses } from '$lib/utils/categories';
  import { cn } from '$lib/utils/cn';
  import * as m from '$lib/paraglide/messages';

  let { menu, childId }: { menu: Menu; childId: number } = $props();

  // i18n-keep: menuMealMatin menuMealMidi menuMealGouter menuMealSoir
  const MEAL_LABELS: Record<MealId, () => string> = {
    matin: m.menuMealMatin,
    midi: m.menuMealMidi,
    gouter: m.menuMealGouter,
    soir: m.menuMealSoir
  };
  const mealLabel = (id: MealId) => MEAL_LABELS[id]();

  // Every RoleId has an explicit resolver so the map stays exhaustive and
  // TS-enforced (mirrors engine.ts's amountFor style). 'fruit' uses the
  // singular menuRoleFruit label — the dessert role reuses the plural
  // categoryFruits/menuRoleDessert wording, but a lone "discover" slot needs
  // "Fruit", not "Fruits".
  // i18n-keep: menuRoleLegume menuRoleProteine menuRoleFeculent menuRoleMatiereGrasse menuRoleDessert menuRoleLaitier menuRoleFruit
  const ROLE_LABELS: Record<RoleId, () => string> = {
    legume: m.menuRoleLegume,
    fruit: m.menuRoleFruit,
    proteine: m.menuRoleProteine,
    feculent: m.menuRoleFeculent,
    matiereGrasse: m.menuRoleMatiereGrasse,
    laitier: m.menuRoleLaitier,
    dessert: m.menuRoleDessert
  };
  const roleLabel = (role: RoleId) => ROLE_LABELS[role]();

  const logHref = (foodId: number) => `/child/${childId}/log?foodId=${foodId}`;
</script>

<p class="mb-3 text-xs text-ink-soft">{m.menuMilkComplement()}</p>

{#if menu.allergenFocus}
  <Card variant="tile-lilac" class="mb-4 p-4">
    <div class="text-xs font-semibold uppercase tracking-wider">{m.menuAllergenOfDay()}</div>
    <div class="font-medium">{menu.allergenFocus.food.name}</div>
    {#if menu.allergenFocus.caution}
      <span class="mt-0.5 block text-xs text-ink-soft">{menu.allergenFocus.caution}</span>
    {/if}
  </Card>
{/if}

{#each menu.meals as meal (meal.id)}
  <Card class="mb-3 p-4">
    <h3 class="mb-1 font-semibold">{mealLabel(meal.id)}</h3>
    {#if meal.label}
      <p class="mb-2 text-xs text-ink-soft">{meal.label}</p>
    {/if}
    <ul class="space-y-2">
      {#each meal.items as it (it.role + it.food.id)}
        {@const Icon = getCategoryIcon(it.food.category)}
        {@const cls = getCategoryClasses(it.food.category)}
        <li>
          <a
            href={logHref(it.food.id)}
            class="-m-1.5 flex items-start gap-2 rounded-tile p-1.5 transition-colors hover:bg-surface-2"
          >
            <span
              class={cn(
                'flex h-8 w-8 shrink-0 items-center justify-center rounded-full',
                cls.tint,
                cls.text
              )}
            >
              <Icon size={16} aria-hidden="true" />
            </span>
            <span class="min-w-0 flex-1">
              <span class="flex flex-wrap items-baseline gap-x-2">
                <span class="font-medium">{it.food.name}</span>
                {#if it.amountHint}
                  <span class="text-xs text-ink-soft">{it.amountHint}</span>
                {/if}
              </span>
              {#if it.isNew}
                <span class="mt-1 flex flex-wrap items-center gap-2">
                  <Badge>{m.menuNovelty()}</Badge>
                  <span class="text-xs text-ink-soft">{m.menuNoveltyHint()}</span>
                </span>
              {/if}
              {#if it.caution}
                <span class="mt-0.5 block text-xs text-ink-soft">{it.caution}</span>
              {/if}
            </span>
          </a>
        </li>
      {/each}
    </ul>
    {#if meal.discoverRoles.length > 0}
      <ul class="mt-2 space-y-1 border-t border-border/60 pt-2">
        {#each meal.discoverRoles as role (role)}
          <li>
            <a
              href={`/child/${childId}/suggestions`}
              class="text-xs text-ink-soft underline decoration-dotted underline-offset-2"
            >
              {roleLabel(role)} · {m.menuDiscoverSlot()}
            </a>
          </li>
        {/each}
      </ul>
    {/if}
  </Card>
{/each}

{#if menu.redFlags.length > 0}
  <Callout variant="warning" class="mb-3">
    <ul class="list-disc space-y-1 pl-5">
      {#each menu.redFlags as flag, i (i)}
        <li>{flag}</li>
      {/each}
    </ul>
  </Callout>
{/if}

<p class="text-xs text-ink-soft">{menu.textures} — {m.menuSatiety()}</p>
