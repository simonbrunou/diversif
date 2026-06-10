<script lang="ts">
  import OnboardingForm from '$lib/components/bento/OnboardingForm.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import * as m from '$lib/paraglide/messages';
  import type { ActionData, PageData } from './$types';

  let { data: _data, form }: { data: PageData; form: ActionData } = $props();

  const errors = $derived(form?.errors ?? null);
  // Every failure payload echoes the typed values (400 and 429 alike), so no
  // shape narrowing is needed.
  const values = $derived(form ? { firstName: form.firstName, birthDate: form.birthDate } : null);
</script>

<Seo title={m.onboardingTitle()} path="/child/new" noindex alternateLocales={['en']} />

<div class="flex min-h-[100dvh] flex-col items-center bg-canvas px-4 py-10">
  <div class="w-full max-w-md">
    <OnboardingForm {errors} {values} />
  </div>
</div>
