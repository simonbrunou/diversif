import { describe, it, expect } from 'vitest';
import { SYMPTOM_LABELS, severityOf, type SymptomLabel } from './symptoms';

describe('symptom vocabulary', () => {
  it('exposes 10 picklist labels', () => {
    expect(SYMPTOM_LABELS).toHaveLength(10);
  });

  it('every label maps to a known severity', () => {
    for (const label of SYMPTOM_LABELS) {
      expect(['neutral', 'warn', 'severe']).toContain(severityOf(label));
    }
  });
});

describe('severityOf', () => {
  it.each([
    ['gonflement', 'severe'],
    ['detresse-respiratoire', 'severe'],
    ['levres-bleues', 'severe'],
    ['urticaire', 'warn'],
    ['eczema', 'warn'],
    ['vomissement', 'warn'],
    ['diarrhee', 'warn'],
    ['rougeur', 'neutral'],
    ['toux', 'neutral'],
    ['autre', 'neutral']
  ] as const)('maps %s → %s', (label, expected) => {
    expect(severityOf(label as SymptomLabel)).toBe(expected);
  });
});
