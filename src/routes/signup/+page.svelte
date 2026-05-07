<script lang="ts">
  import Button from '$components/ui/Button.svelte';
  import Input from '$components/ui/Input.svelte';
  import Label from '$components/ui/Label.svelte';
  import Card from '$components/ui/Card.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import { enhance } from '$app/forms';
  import * as m from '$lib/paraglide/messages';
  import type { ActionData, PageData } from './$types';

  let { data, form }: { data: PageData; form: ActionData } = $props();
  let submitting = $state(false);
</script>

<Seo title={m.authSignupTitle()} path="/signup" noindex />

<div class="container flex max-w-md flex-1 flex-col justify-center py-10">
  <div class="text-center">
    <h1 class="text-3xl font-semibold">{m.authSignupHeading()}</h1>
    <p class="mt-2 text-sm text-muted-foreground">
      {data.inviteCode ? m.authSignupSubheadingInvited() : m.authSignupSubheadingDefault()}
    </p>
  </div>

  <Card class="mt-8 p-6">
    <form
      method="POST"
      class="grid gap-4"
      use:enhance={() => {
        submitting = true;
        return async ({ update }) => {
          await update();
          submitting = false;
        };
      }}
    >
      {#if form?.errorKey}
        {@const k = form.errorKey as keyof typeof m}
        <div class="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          {(m[k] as (() => string) | undefined)?.() ?? /* v8 ignore next */ m.errorsGenericFallback()}
        </div>
      {/if}

      <div class="grid gap-1.5">
        <Label for="displayName">{m.authSignupDisplayNameLabel()}</Label>
        <Input
          id="displayName"
          name="displayName"
          autocomplete="given-name"
          required
          maxlength={80}
          value={form?.displayName ?? ''}
        />
      </div>

      <div class="grid gap-1.5">
        <Label for="email">{m.authSignupEmailLabel()}</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autocomplete="email"
          required
          value={form?.email ?? ''}
        />
      </div>

      <div class="grid gap-1.5">
        <Label for="password">{m.authSignupPasswordLabel()}</Label>
        <Input id="password" name="password" type="password" autocomplete="new-password" required minlength={12} />
        <p class="text-xs text-muted-foreground">{m.authSignupPasswordHint()}</p>
      </div>

      <div class="grid gap-1.5">
        <Label for="inviteCode">{m.authSignupInviteCodeLabel()}</Label>
        <Input
          id="inviteCode"
          name="inviteCode"
          placeholder="BEBE-XXXXXX"
          value={form?.inviteCode ?? data.inviteCode}
          autocomplete="off"
        />
      </div>

      <div class="grid gap-2 rounded-md border bg-surface/50 p-3 text-sm">
        <label class="flex items-start gap-2">
          <input type="checkbox" name="confirmAge15" required class="mt-0.5" />
          <span>{m.authSignupAge15()}</span>
        </label>
        <label class="flex items-start gap-2">
          <input type="checkbox" name="acceptTos" required class="mt-0.5" />
          <span>
            {m.authSignupAcceptTosPrefix()}
            <a href="/cgu" target="_blank" rel="noopener" class="underline">{m.authSignupAcceptTosLink()}</a>.
          </span>
        </label>
        <label class="flex items-start gap-2">
          <input type="checkbox" name="acceptPrivacy" required class="mt-0.5" />
          <span>
            {m.authSignupAcceptPrivacyPrefix()}
            <a href="/politique-confidentialite" target="_blank" rel="noopener" class="underline">{m.authSignupAcceptPrivacyLink()}</a>
            {m.authSignupAcceptPrivacySuffix()}
          </span>
        </label>
      </div>

      <Button type="submit" size="lg" loading={submitting}>
        {submitting ? m.authSignupSubmitting() : m.authSignupSubmit()}
      </Button>
    </form>
  </Card>

  <p class="mt-6 text-center text-sm text-muted-foreground">
    {m.authSignupAlreadyAccount()} <a href="/login" class="font-medium text-primary hover:underline">{m.authSignupLogin()}</a>
  </p>
</div>
