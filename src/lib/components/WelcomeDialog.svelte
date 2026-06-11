<script lang="ts">
  import Modal from '$components/ui/Modal.svelte';
  import Button from '$components/ui/Button.svelte';
  import { enhance } from '$app/forms';
  import { goto } from '$app/navigation';
  import { Heart, Sparkles, BookOpen } from 'lucide-svelte';
  import * as m from '$lib/paraglide/messages';
  import { localizedHref } from '$lib/utils/localized-href';

  let {
    open = $bindable(false),
    childId,
    formAction
  }: { open?: boolean; childId: number; formAction: string } = $props();

  let step = $state(0);

  function next() {
    step += 1;
  }

  function close() {
    open = false;
    step = 0;
  }
</script>

<Modal bind:open onclose={close} side="center" class="max-w-md">
  <div class="space-y-3 text-sm">
    {#if step === 0}
      <div class="flex items-center gap-2">
        <Heart size={20} class="text-primary" aria-hidden="true" />
        <h2 class="text-lg font-semibold">{m.dialogsWelcomeStep0Title()}</h2>
      </div>
      <p class="text-foreground">
        {m.dialogsWelcomeStep0Body()}
      </p>
      <ul class="list-disc space-y-1.5 pl-5 text-foreground">
        <li>
          {m.dialogsWelcomeStep0Bullet1Before()} <strong>{m.dialogsWelcomeStep0Bullet1Bold()}</strong>{m.dialogsWelcomeStep0Bullet1After()}
        </li>
        <li>
          {m.dialogsWelcomeStep0Bullet2Before()} <strong>{m.dialogsWelcomeStep0Bullet2Bold()}</strong> {m.dialogsWelcomeStep0Bullet2After()}
        </li>
        <li>
          {m.dialogsWelcomeStep0Bullet3Before()} <strong>{m.dialogsWelcomeStep0Bullet3Bold()}</strong> {m.dialogsWelcomeStep0Bullet3After()}
        </li>
      </ul>
    {:else if step === 1}
      <div class="flex items-center gap-2">
        <Sparkles size={20} class="text-primary" aria-hidden="true" />
        <h2 class="text-lg font-semibold">{m.dialogsWelcomeStep1Title()}</h2>
      </div>
      <ul class="list-disc space-y-1.5 pl-5 text-foreground">
        <li><strong>{m.dialogsWelcomeStep1Bullet1Bold()}</strong>{m.dialogsWelcomeStep1Bullet1After()}</li>
        <li><strong>{m.dialogsWelcomeStep1Bullet2Bold()}</strong>{m.dialogsWelcomeStep1Bullet2After()}</li>
        <li><strong>{m.dialogsWelcomeStep1Bullet3Bold()}</strong>{m.dialogsWelcomeStep1Bullet3After()}</li>
        <li><strong>{m.dialogsWelcomeStep1Bullet4Bold()}</strong>{m.dialogsWelcomeStep1Bullet4After()}</li>
        <li><strong>{m.dialogsWelcomeStep1Bullet5Bold()}</strong>{m.dialogsWelcomeStep1Bullet5After()}</li>
      </ul>
    {:else}
      <div class="flex items-center gap-2">
        <BookOpen size={20} class="text-primary" aria-hidden="true" />
        <h2 class="text-lg font-semibold">{m.dialogsWelcomeStep2Title()}</h2>
      </div>
      <p class="text-foreground">
        {m.dialogsWelcomeStep2Body1()}
      </p>
      <p class="text-foreground">
        {m.dialogsWelcomeStep2Body2()}
      </p>
    {/if}
  </div>

  {#snippet footer()}
    <!-- Both « Plus tard » and « Ouvrir le guide » submit this dismiss form,
         so the dialog never re-opens on the next dashboard visit whichever
         exit the user takes. The guide CTA additionally navigates after the
         dismissal has been persisted (its submitter carries data-then-guide). -->
    <form
      id="welcome-dismiss-form"
      method="POST"
      action={formAction}
      use:enhance={({ submitter }) => {
        const thenGuide = submitter?.getAttribute('data-then-guide') === 'true';
        return () => {
          close();
          if (thenGuide) void goto(localizedHref(`/child/${childId}/guide`));
        };
      }}
    >
      <input type="hidden" name="reminderKey" value="welcome-dialog" />
      <Button variant="ghost" type="submit">{m.dialogsWelcomeButtonDismiss()}</Button>
    </form>
    {#if step < 2}
      <Button onclick={next}>{m.dialogsWelcomeButtonNext()}</Button>
    {:else}
      <Button type="submit" form="welcome-dismiss-form" data-then-guide="true">
        {m.dialogsWelcomeButtonOpenGuide()}
      </Button>
    {/if}
  {/snippet}
</Modal>
