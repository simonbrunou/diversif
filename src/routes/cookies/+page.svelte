<script lang="ts">
  import Seo from '$lib/components/Seo.svelte';
</script>

<Seo
  title="Cookies · Diversif"
  description="Diversif n'utilise que deux cookies strictement nécessaires au fonctionnement du service. Aucun cookie de mesure ni de publicité."
  path="/cookies"
  noindex
/>

<div class="container max-w-3xl space-y-6 py-8 md:py-12">
  <header class="space-y-2">
    <h1 class="text-2xl font-semibold tracking-tight md:text-3xl">Cookies</h1>
    <p class="text-sm text-muted-foreground">Dernière mise à jour : 4 mai 2026.</p>
  </header>

  <p class="text-sm">
    Diversif n'utilise que deux cookies strictement nécessaires au fonctionnement du service. Au
    sens des lignes directrices CNIL et de la directive ePrivacy, aucun consentement préalable
    n'est requis. Aucun cookie de mesure d'audience, de publicité ou de partage social n'est
    déposé. Aucun service tiers n'est sollicité.
  </p>

  <div class="overflow-x-auto">
    <table class="w-full text-sm">
      <thead class="text-left">
        <tr>
          <th class="border-b py-2 pr-4 font-semibold">Nom</th>
          <th class="border-b py-2 pr-4 font-semibold">Finalité</th>
          <th class="border-b py-2 pr-4 font-semibold">Durée</th>
          <th class="border-b py-2 font-semibold">Attributs</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td class="border-b py-2 pr-4 font-mono">session</td>
          <td class="border-b py-2 pr-4">Maintenir la session authentifiée du parent.</td>
          <td class="border-b py-2 pr-4">30 jours</td>
          <td class="border-b py-2">HttpOnly · SameSite=Lax · Secure (en production)</td>
        </tr>
        <tr>
          <td class="border-b py-2 pr-4 font-mono">wa_challenge</td>
          <td class="border-b py-2 pr-4">Sécuriser une cérémonie WebAuthn (clé d'accès).</td>
          <td class="border-b py-2 pr-4">5 minutes</td>
          <td class="border-b py-2">HttpOnly · SameSite=Strict · Secure (en production)</td>
        </tr>
      </tbody>
    </table>
  </div>

  <p class="text-sm">
    Pour vous déconnecter et supprimer le cookie <span class="font-mono">session</span> de cet
    appareil, utilisez le bouton « Se déconnecter » depuis « Mon compte ». Pour invalider toutes
    les sessions actives, utilisez « Se déconnecter partout ».
  </p>
</div>
