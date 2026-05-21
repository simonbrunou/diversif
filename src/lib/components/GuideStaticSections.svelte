<script lang="ts" module>
  export const STATIC_NAV_SECTIONS = [
    { id: 'regles', label: "Règles d'or" },
    { id: 'etapes', label: 'Les 4 étapes' },
    { id: 'allergenes', label: 'Allergènes' },
    { id: 'categories', label: 'Groupes alimentaires' },
    { id: 'textures', label: 'Textures' },
    { id: 'eviter', label: 'À éviter' },
    { id: 'reactions', label: 'Réactions' },
    { id: 'approches', label: 'Approches' },
    { id: 'sources', label: 'Sources' }
  ] as const;
</script>

<script lang="ts">
  import { type StageId } from '$lib/content/guidance';
  import GuideReglesSection from './guide/GuideReglesSection.svelte';
  import GuideStagesSection from './guide/GuideStagesSection.svelte';
  import GuideAllergensSection from './guide/GuideAllergensSection.svelte';
  import GuideCategoriesSection from './guide/GuideCategoriesSection.svelte';
  import GuideTexturesSection from './guide/GuideTexturesSection.svelte';
  import GuideForbiddenSection from './guide/GuideForbiddenSection.svelte';
  import GuideReactionsSection from './guide/GuideReactionsSection.svelte';
  import GuideApproachesSection from './guide/GuideApproachesSection.svelte';
  import GuideSourcesSection from './guide/GuideSourcesSection.svelte';

  let { currentStageId = null }: { currentStageId?: StageId | null } = $props();
</script>

<GuideReglesSection />
<GuideStagesSection {currentStageId} />
<GuideAllergensSection />
<GuideCategoriesSection />
<GuideTexturesSection />
<GuideForbiddenSection />
<GuideReactionsSection />
<GuideApproachesSection />
<GuideSourcesSection />
