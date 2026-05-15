<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import * as m from '$lib/paraglide/messages';
</script>

<Seo
  title="Cookies · Diversif"
  description="Diversif n'utilise que deux cookies strictement nécessaires au fonctionnement du service. Aucun cookie de mesure ni de publicité."
  path="/cookies"
  noindex
  alternateLocales={['en']}
/>

<div class="mx-auto max-w-3xl px-6 py-6 text-ink sm:px-10">
  <BackHeader fallback="/" />
  <header class="space-y-2">
    <h1 class="font-display text-3xl italic">{m.legalCookiesTitle()}</h1>
    <p class="text-sm leading-relaxed">{m.legalCookiesUpdated()}</p>
  </header>

  <p class="text-sm leading-relaxed">
    {m.legalCookiesDisclaimer()}
  </p>

  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="text-left">
        <tr>
          <th class="border-b py-2 pr-4 font-semibold">{m.legalCookiesNameHeader()}</th>
          <th class="border-b py-2 pr-4 font-semibold">{m.legalCookiesPurposeHeader()}</th>
          <th class="border-b py-2 pr-4 font-semibold">{m.legalCookiesDurationHeader()}</th>
          <th class="border-b py-2 font-semibold">{m.legalCookiesAttrHeader()}</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="border-b py-2 pr-4 font-mono">session</td>
          <td class="border-b py-2 pr-4">{m.legalCookiesRow1Purpose()}</td>
          <td class="border-b py-2 pr-4">{m.legalCookiesRow1Duration()}</td>
          <td class="border-b py-2">HttpOnly · SameSite=Lax · Secure (en production)</td>
        </tr>
        <tr>
          <td class="border-b py-2 pr-4 font-mono">wa_challenge</td>
          <td class="border-b py-2 pr-4">{m.legalCookiesRow2Purpose()}</td>
          <td class="border-b py-2 pr-4">{m.legalCookiesRow2Duration()}</td>
          <td class="border-b py-2">HttpOnly · SameSite=Strict · Secure (en production)</td>
        </tr>
      </tbody>
    </table>
  </div>

  <p class="text-sm leading-relaxed">
    {m.legalCookiesFooterBefore()} <span class="font-mono">session</span> {m.legalCookiesFooterAfter()}
  </p>
</div>
