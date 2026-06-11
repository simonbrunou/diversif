<script lang="ts">
  import Card from '$components/ui/Card.svelte';
  import Button from '$components/ui/Button.svelte';
  import FormError from '$components/ui/FormError.svelte';
  import { localizedHref } from '$lib/utils/localized-href';
  import * as m from '$lib/paraglide/messages';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
</script>

<div class="mx-auto w-full px-4 flex max-w-md flex-1 flex-col justify-center py-10">
  <Card class="p-6 text-center">
    <h1 class="text-xl font-semibold">{m.joinTitle()}</h1>

    {#if data.error}
      <p class="mt-3 text-sm text-severe-text">{data.error}</p>
      <div class="mt-6">
        <Button href={localizedHref('/')} variant="outline">{m.joinBack()}</Button>
      </div>
    {:else if data.child}
      <p class="mt-3 text-sm text-muted-foreground">
        {#if data.inviter}
          {m.joinInviteIntroNamed({ inviter: data.inviter, child: data.child.name })}
        {:else}
          {m.joinInviteIntroAnon({ child: data.child.name })}
        {/if}
      </p>
      <p class="mt-2 text-sm text-muted-foreground">
        {m.joinInviteExplainer({ child: data.child.name })}
      </p>
      <p class="mt-2 text-xs text-muted-foreground">{m.joinCodeLine()} <span class="font-mono">{data.code}</span></p>

      {#if form?.error}
        <FormError class="mt-4">{form.error}</FormError>
      {/if}

      <form method="POST" class="mt-6 flex justify-center gap-2">
        <Button href={localizedHref('/')} variant="outline">{m.commonCancel()}</Button>
        <Button type="submit">{m.joinAcceptCta()}</Button>
      </form>
    {/if}
  </Card>
</div>
