import { describe, expect, it } from 'bun:test';
import { SYMPTOM_LABELS, severityOf, symptomLabelText, type SymptomLabel } from './symptoms';

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

describe('symptomLabelText', () => {
  it('returns a non-empty localized label for every symptom', () => {
    for (const label of SYMPTOM_LABELS) {
      expect(symptomLabelText(label).length).toBeGreaterThan(0);
    }
  });

  it('PascalCases hyphenated labels into the paraglide key (no raw key leaks)', () => {
    // A missing/mis-derived key would surface the key string itself; assert the
    // resolved copy differs from the constructed key for a hyphenated label.
    expect(symptomLabelText('detresse-respiratoire')).not.toBe('symptomsLabelDetresseRespiratoire');
    expect(symptomLabelText('levres-bleues')).not.toBe('symptomsLabelLevresBleues');
  });
});
