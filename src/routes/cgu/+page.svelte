<script lang="ts">
  import Seo from '$lib/components/Seo.svelte';
  import * as m from '$lib/paraglide/messages';
  import { page } from '$app/stores';
  import { localizedHref } from '$lib/utils/localized-href';
</script>

<Seo
  title="Conditions d'utilisation · Diversif"
  description="Conditions générales d'utilisation du service Diversif."
  path="/cgu"
  noindex
/>

<div class="mx-auto max-w-3xl px-6 py-10 text-ink sm:px-10">
  {#if $page.url.pathname.startsWith('/en')}
    <aside class="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900" role="note">
      {m.commonFrOnlyBannerLegal()}
    </aside>
  {/if}

  <section lang="fr" class="mt-8 space-y-3">
    <header class="space-y-2">
      <h1 class="font-display text-3xl italic">Conditions générales d'utilisation</h1>
      <p class="text-sm leading-relaxed">Dernière mise à jour : 4 mai 2026.</p>
    </header>

  <section class="mt-8 space-y-3">
    <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">1. Objet</h2>
    <p class="text-sm leading-relaxed">
      Diversif est un service en ligne d'aide au suivi de la diversification alimentaire d'un
      enfant. Les présentes conditions encadrent son utilisation.
    </p>
  </section>

  <section class="mt-8 space-y-3">
    <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">2. Conditions d'accès</h2>
    <p class="text-sm leading-relaxed">
      L'accès au service nécessite la création d'un compte. L'utilisateur doit être âgé d'au moins
      15 ans (article 45 de la loi Informatique et Libertés). Les fonctionnalités sont mises à
      disposition gratuitement, sans publicité, sans mesure d'audience.
    </p>
  </section>

  <section class="mt-8 space-y-3">
    <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">3. Compte et sécurité</h2>
    <p class="text-sm leading-relaxed">
      L'utilisateur choisit un mot de passe d'au moins 12 caractères ou utilise une clé d'accès
      WebAuthn. Il est responsable de la confidentialité de ses identifiants. Toute activité
      effectuée depuis son compte est réputée provenir de lui-même.
    </p>
  </section>

  <section class="mt-8 space-y-3">
    <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">4. Contenu utilisateur</h2>
    <p class="text-sm leading-relaxed">
      L'utilisateur reste propriétaire des informations qu'il enregistre (fiche de l'enfant,
      journal des aliments, observations, notes). Il garantit disposer du droit d'enregistrer ces
      informations, en particulier celles relatives à un enfant dont il est responsable légal ou
      pour lequel il dispose de l'autorisation parentale.
    </p>
  </section>

  <section class="mt-8 space-y-3">
    <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">5. Avertissement médical</h2>
    <p class="text-sm leading-relaxed">
      Les contenus de Diversif sont à visée informative et ne se substituent en aucun cas à un
      avis médical individuel. En cas de doute ou de réaction, l'utilisateur est invité à
      consulter un pédiatre ou un allergologue.
    </p>
  </section>

  <section class="mt-8 space-y-3">
    <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">6. Disponibilité</h2>
    <p class="text-sm leading-relaxed">
      Le service est fourni « en l'état », sans garantie de disponibilité ni d'absence d'erreurs.
      L'éditeur peut interrompre tout ou partie du service à des fins de maintenance ou
      d'évolution.
    </p>
  </section>

  <section class="mt-8 space-y-3">
    <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">7. Données personnelles</h2>
    <p class="text-sm leading-relaxed">
      Le traitement des données personnelles est décrit sur la page
      <a class="text-primary underline" href={localizedHref('/politique-confidentialite')}>Politique de confidentialité</a>.
      L'utilisateur peut à tout moment exporter ou supprimer ses données depuis « Mon compte ».
    </p>
  </section>

  <section class="mt-8 space-y-3">
    <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">8. Suppression du compte</h2>
    <p class="text-sm leading-relaxed">
      L'utilisateur peut supprimer son compte à tout moment depuis la page « Mon compte ». La
      suppression est immédiate et irréversible : sessions, clés d'accès, appartenances et
      enfants dont il est seul responsable sont supprimés. Les enfants partagés avec un autre
      parent restent accessibles à ce dernier.
    </p>
  </section>

    <section class="mt-8 space-y-3">
      <h2 class="text-sm font-semibold uppercase tracking-wider text-ink-soft">9. Loi applicable</h2>
      <p class="text-sm leading-relaxed">
        Les présentes conditions sont soumises au droit français. Tout litige relève des
        juridictions françaises compétentes.
      </p>
    </section>
  </section>
</div>
