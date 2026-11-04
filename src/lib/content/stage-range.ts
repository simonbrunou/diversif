// The age range of a stage, as every screen that names the stage prints it:
// the guide's stage badge, and the stage card on Aujourd'hui whose CTA opens
// the guide. STAGES titles carry the same range in French, and
// guidance.test.ts holds them to it. `ageMax` is exclusive, so `9–12 mois`
// covers 9, 10 and 11 months. En dash, no spaces: DESIGN.md, "The One Dash
// Rule".

import * as m from '#lib/paraglide/messages.js';
import type { Stage } from './guidance';

export function stageRange({ ageMin, ageMax }: Pick<Stage, 'ageMin' | 'ageMax'>): string {
  if (ageMax >= 24 && ageMax % 12 === 0) {
    return m.stageRangeMonthsToYears({ min: ageMin, years: ageMax / 12 });
  }
  return m.stageRangeMonths({ min: ageMin, max: ageMax });
}
