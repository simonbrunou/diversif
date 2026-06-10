// Server-side aggregations supporting the guidance UI: diversity metrics,
// repeat-exposure candidates, dismissal lookups, timeline rollups. Pure SQL
// via Drizzle. Imports of the legacy `./queries` path continue to work via
// this barrel re-export.

export { loadTexturesTried } from './seasonal';
export {
  loadDiversityMetrics,
  loadRepeatCandidates,
  loadWeeklyRecap,
  type DiversityMetrics,
  type RepeatCandidate,
  type WeeklyRecap
} from './diversity';
export {
  loadStreak,
  loadCoparentActivity,
  type EnrichedEntry,
  type CoparentEntry
} from './timeline';
export { loadDismissals, dismissReminder } from './dismissals';
