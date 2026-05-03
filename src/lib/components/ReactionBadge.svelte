<script lang="ts">
  import Badge from '$components/ui/Badge.svelte';
  import type { ReactionId } from '$lib/utils/reactions';
  import { getReactionLabel } from '$lib/utils/reactions';

  let { reaction }: { reaction: ReactionId } = $props();
</script>

<Badge variant={reaction}>{getReactionLabel(reaction)}</Badge>
