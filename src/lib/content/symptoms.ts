import * as m from '$lib/paraglide/messages';

export const SYMPTOM_LABELS = [
  'rougeur',
  'urticaire',
  'eczema',
  'vomissement',
  'diarrhee',
  'gonflement',
  'toux',
  'detresse-respiratoire',
  'levres-bleues',
  'autre'
] as const;

export type SymptomLabel = (typeof SYMPTOM_LABELS)[number];

export type Severity = 'neutral' | 'warn' | 'severe';

const SEVERE: ReadonlySet<SymptomLabel> = new Set([
  'gonflement',
  'detresse-respiratoire',
  'levres-bleues'
]);

const WARN: ReadonlySet<SymptomLabel> = new Set(['urticaire', 'eczema', 'vomissement', 'diarrhee']);

export function severityOf(label: SymptomLabel): Severity {
  if (SEVERE.has(label)) return 'severe';
  if (WARN.has(label)) return 'warn';
  return 'neutral';
}

// Localized display label for a symptom, resolved through paraglide. The key is
// derived from the SymptomLabel by PascalCasing its hyphenated segments
// (e.g. 'detresse-respiratoire' → symptomsLabelDetresseRespiratoire).
export function symptomLabelText(label: SymptomLabel): string {
  const key = `symptomsLabel${label
    .split('-')
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')}` as
    | 'symptomsLabelRougeur'
    | 'symptomsLabelUrticaire'
    | 'symptomsLabelEczema'
    | 'symptomsLabelVomissement'
    | 'symptomsLabelDiarrhee'
    | 'symptomsLabelGonflement'
    | 'symptomsLabelToux'
    | 'symptomsLabelDetresseRespiratoire'
    | 'symptomsLabelLevresBleues'
    | 'symptomsLabelAutre';
  return m[key]();
}
