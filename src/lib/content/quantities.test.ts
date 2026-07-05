import { test, expect } from 'bun:test';
import { QUANTITIES, getQuantitiesForStage } from './quantities';
import { STAGES } from './guidance';
import { SOURCES } from './sources';

test('every stage has quantities', () => {
  for (const s of STAGES) {
    expect(QUANTITIES[s.id]).toBeDefined();
    expect(QUANTITIES[s.id].stageId).toBe(s.id);
  }
});

test('9-12 egg fraction is a quarter (thirds begin after 1 an)', () => {
  expect(QUANTITIES['9-12'].eggFraction).toBe('¼');
});

test('sources reference real SourceIds', () => {
  for (const q of Object.values(QUANTITIES)) {
    expect(q.sources.length).toBeGreaterThan(0);
    for (const id of q.sources) {
      expect(SOURCES[id]).toBeDefined();
    }
  }
});

test('getQuantitiesForStage returns the matching row', () => {
  expect(getQuantitiesForStage('6-9').stageId).toBe('6-9');
});
