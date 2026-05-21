// Server-side aggregations supporting the guidance UI: diversity metrics,
// repeat-exposure candidates, dismissal lookups, timeline rollups. Pure SQL
// via Drizzle. Imports of the legacy `./queries` path continue to work via
// this barrel re-export.

export {
  loadSeasonalFoods,
  loadTexturesTried,
  loadTextureProgress,
  type SeasonalFood,
  type TextureProgress
} from './seasonal';
export {
  loadDiversityMetrics,
  loadRepeatCandidates,
  loadWeeklyRecap,
  type DiversityMetrics,
  type RepeatCandidate,
  type WeeklyRecap
} from './diversity';
export {
  loadRecentEntries,
  loadStreak,
  loadCoparentActivity,
  loadAnalyticsBuckets,
  type EnrichedEntry,
  type CoparentEntry,
  type WeekBucket
} from './timeline';
export { loadDismissals, dismissReminder } from './dismissals';
