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
