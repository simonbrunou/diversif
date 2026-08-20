<script lang="ts">
  import { CATEGORIES } from '$lib/utils/categories';
  import Input from '$components/ui/Input.svelte';
  import Select from '$components/ui/Select.svelte';
  import * as m from '$lib/paraglide/messages';

  let {
    customName,
    open,
    nameValue = $bindable(),
    category = $bindable(),
    onOpen,
    onClose
  }: {
    customName: string;
    open: boolean;
    nameValue: string;
    category: string;
    onOpen: () => void;
    onClose: () => void;
  } = $props();
</script>

<button
  type="button"
  class="inline-flex min-h-11 items-center rounded-sm text-left text-sm text-primary-strong hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
  onclick={onOpen}
>
  {m.foodComboboxAddCustomCta()}
</button>

{#if open}
  <div class="grid gap-3 rounded-md border bg-card p-3">
    <div class="grid gap-1.5">
      <label for="custom-name" class="text-sm font-medium">{m.foodComboboxCustomNameLabel()}</label>
      <Input
        id="custom-name"
        name={`${customName}.name`}
        bind:value={nameValue}
        required
        maxlength={80}
      />
    </div>
    <div class="grid gap-1.5">
      <label for="custom-cat" class="text-sm font-medium"
        >{m.foodComboboxCustomCategoryLabel()}</label
      >
      <Select id="custom-cat" name={`${customName}.category`} bind:value={category}>
        {#each CATEGORIES as c (c.id)}
          <option value={c.id}>{c.label}</option>
        {/each}
      </Select>
    </div>
    <p class="text-xs text-muted-foreground">
      {m.foodComboboxCustomScopeHint()}
    </p>
    <button
      type="button"
      class="justify-self-start rounded-sm text-sm text-muted-foreground hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
      onclick={onClose}
    >
      {m.commonCancel()}
    </button>
  </div>
{/if}
