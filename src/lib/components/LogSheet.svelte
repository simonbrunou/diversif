<script lang="ts">
  import Modal from './ui/Modal.svelte';
  import Command, { type CommandItem } from './ui/Command.svelte';
  import ReactionPicker from './ReactionPicker.svelte';
  import { toast } from './ui/Toast.svelte';
  import * as m from '$lib/paraglide/messages';
  import { enhance } from '$app/forms';
  import type { ReactionId } from '$lib/utils/reactions';

  let {
    open = $bindable(false),
    childId,
    childName,
    foods
  }: {
    open: boolean;
    childId: string;
    childName: string;
    foods: { id: string; label: string }[];
  } = $props();

  let selectedFood = $state('');
  let reaction = $state<ReactionId>('ras');

  const items: CommandItem[] = $derived(
    foods.map((f) => ({ value: f.id, label: f.label }))
  );
</script>

<Modal bind:open title={m.chromeLogSheetTitle({ name: childName })} side="bottom">
  <form
    method="POST"
    action={`/child/${childId}/log`}
    use:enhance={() => {
      return async ({ result, update }) => {
        if (result.type === 'success' || result.type === 'redirect') {
          toast.success(m.chromeLogSheetSavedToast());
          open = false;
          selectedFood = '';
          reaction = 'ras';
        }
        await update();
      };
    }}
    class="flex max-h-[80vh] flex-col gap-3 overflow-y-auto"
  >
    <Command
      {items}
      bind:value={selectedFood}
      placeholder={m.chromeLogSheetPlaceholder()}
    />
    <input type="hidden" name="foodId" value={selectedFood} />
    <input type="hidden" name="givenAt" value={new Date().toISOString()} />
    <ReactionPicker name="reaction" bind:value={reaction} />
    <button
      type="submit"
      disabled={!selectedFood}
      class="mt-2 w-full scroll-mb-[50vh] rounded-tile bg-primary px-4 py-3 text-sm font-bold text-primary-foreground shadow-soft transition-colors duration-base ease-soft disabled:opacity-50"
    >
      {m.chromeLogSheetSave()}
    </button>
  </form>
</Modal>
