<script lang="ts">
  import BackHeader from '$components/ui/BackHeader.svelte';
  import Callout from '$lib/components/ui/Callout.svelte';
  import Seo from '$lib/components/Seo.svelte';
  import SectionHeader from '$lib/components/ui/SectionHeader.svelte';
  import * as m from '$lib/paraglide/messages';
  import { page } from '$app/state';
  import { localizedHref } from '$lib/utils/localized-href';
</script>

<Seo
  title="Conditions d'utilisation · Diversif"
  description="Conditions générales d'utilisation du service Diversif."
  path="/cgu"
  noindex
/>

<div class="mx-auto max-w-3xl px-6 py-6 text-ink sm:px-10">
  <BackHeader fallback="/" />
  {#if page.url.pathname.startsWith('/en')}
    <Callout variant="warning">
      {m.commonFrOnlyBannerLegal()}
    </Callout>
  {/if}

  <section lang="fr" class="mt-8 space-y-3">
    <header class="space-y-2">
      <h1 class="font-display text-3xl italic">Conditions générales d'utilisation</h1>
      <p class="text-sm leading-relaxed">Dernière mise à jour : 4 mai 2026.</p>
    </header>

  <section class="mt-8 space-y-3">
    <SectionHeader as="h2">1. Objet</SectionHeader>
    <p class="text-sm leading-relaxed">
      Diversif est un service en ligne d'aide au suivi de la diversification alimentaire d'un
      enfant. Les présentes conditions encadrent son utilisation.
    </p>
  </section>

  <section class="mt-8 space-y-3">
    <SectionHeader as="h2">2. Conditions d'accès</SectionHeader>
    <p class="text-sm leading-relaxed">
      L'accès au service nécessite la création d'un compte. L'utilisateur doit être âgé d'au moins
      15 ans (article 45 de la loi Informatique et Libertés). Les fonctionnalités sont mises à
      disposition gratuitement, sans publicité, sans mesure d'audience.
    </p>
  </section>

  <section class="mt-8 space-y-3">
    <SectionHeader as="h2">3. Compte et sécurité</SectionHeader>
    <p class="text-sm leading-relaxed">
      L'utilisateur choisit un mot de passe d'au moins 12 caractères ou utilise une clé d'accès
      WebAuthn. Il est responsable de la confidentialité de ses identifiants. Toute activité
      effectuée depuis son compte est réputée provenir de lui-même.
    </p>
  </section>

  <section class="mt-8 space-y-3">
    <SectionHeader as="h2">4. Contenu utilisateur</SectionHeader>
    <p class="text-sm leading-relaxed">
      L'utilisateur reste propriétaire des informations qu'il enregistre (fiche de l'enfant,
      journal des aliments, observations, notes). Il garantit disposer du droit d'enregistrer ces
      informations, en particulier celles relatives à un enfant dont il est responsable légal ou
      pour lequel il dispose de l'autorisation parentale.
    </p>
  </section>

  <section class="mt-8 space-y-3">
    <SectionHeader as="h2">5. Avertissement médical</SectionHeader>
    <p class="text-sm leading-relaxed">
      Les contenus de Diversif sont à visée informative et ne se substituent en aucun cas à un
      avis médical individuel. En cas de doute ou de réaction, l'utilisateur est invité à
      consulter un pédiatre ou un allergologue.
    </p>
  </section>

  <section class="mt-8 space-y-3">
    <SectionHeader as="h2">6. Disponibilité</SectionHeader>
    <p class="text-sm leading-relaxed">
      Le service est fourni « en l'état », sans garantie de disponibilité ni d'absence d'erreurs.
      L'éditeur peut interrompre tout ou partie du service à des fins de maintenance ou
      d'évolution.
    </p>
  </section>

  <section class="mt-8 space-y-3">
    <SectionHeader as="h2">7. Données personnelles</SectionHeader>
    <p class="text-sm leading-relaxed">
      Le traitement des données personnelles est décrit sur la page
      <a class="text-primary-strong underline" href={localizedHref('/politique-confidentialite')}>Politique de confidentialité</a>.
      L'utilisateur peut à tout moment exporter ou supprimer ses données depuis « Mon compte ».
    </p>
  </section>

  <section class="mt-8 space-y-3">
    <SectionHeader as="h2">8. Suppression du compte</SectionHeader>
    <p class="text-sm leading-relaxed">
      L'utilisateur peut supprimer son compte à tout moment depuis la page « Mon compte ». La
      suppression est immédiate et irréversible : sessions, clés d'accès, appartenances et
      enfants dont il est seul responsable sont supprimés. Les enfants partagés avec un autre
      parent restent accessibles à ce dernier.
    </p>
  </section>

    <section class="mt-8 space-y-3">
      <SectionHeader as="h2">9. Loi applicable</SectionHeader>
      <p class="text-sm leading-relaxed">
        Les présentes conditions sont soumises au droit français. Tout litige relève des
        juridictions françaises compétentes.
      </p>
    </section>
  </section>
</div>
