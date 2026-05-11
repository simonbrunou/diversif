<script lang="ts">
  import OnboardingForm from '$lib/components/bento/OnboardingForm.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import * as m from '$lib/paraglide/messages';
  import type { ActionData, PageData } from './$types';

  let { data: _data, form }: { data: PageData; form: ActionData } = $props();

  // Map the action's flat error string to OnboardingForm's per-field shape.
  // Task 10 will refactor the action to return a proper `errors` object;
  // until then we surface the error on the firstName field as a fallback.
  const errors = $derived(
    form?.error
      ? { firstName: form.error }
      : null
  );
</script>

<Seo title={m.onboardingTitle()} path="/child/new" noindex alternateLocales={['en']} />

<main class="flex min-h-[100dvh] flex-col items-center bg-canvas px-4 py-10">
  <div class="w-full max-w-md">
    <OnboardingForm {errors} />
  </div>
</main>
