import { CheckCircle2, AlertCircle, OctagonAlert } from 'lucide-svelte';
import type { ReactionId } from './reaction-values';
import { formatDate } from './dates';
import { getLocale } from '$lib/paraglide/runtime';

// Shared icon/class/date-format helpers for the pediatric handoff report
// (report/+page.svelte and its section components) so the reaction ↔
// icon/color mapping stays in exactly one place.
export function reportReactionIcon(r: ReactionId) {
  return r === 'ras' ? CheckCircle2 : r === 'inconfort' ? AlertCircle : OctagonAlert;
}

export function reportReactionClass(r: ReactionId): string {
  return r === 'ras'
    ? 'text-reaction-ras-foreground'
    : r === 'inconfort'
      ? 'text-reaction-inconfort-foreground'
      : 'text-reaction-reaction-foreground';
}

export function formatReportDay(ts: number): string {
  return formatDate(ts, getLocale() === 'en' ? 'en-GB' : 'fr-FR');
}
