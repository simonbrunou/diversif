import { describe, expect, it } from 'bun:test';
import { pinHostZone } from '../../../test/bun-test-utils';
import { RepasAbort } from './core';
import { parseEntryEditForm, parseLogForm, parseMealEditForm } from './fields';

// What each parser needs besides the date: one aliment and a reaction. A
// plain FormData: src/test/repas.ts's `form` would set up the test database.
function form(givenAt: string): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries({
    foodId: '1',
    reaction: 'ras',
    reactionLoaded: 'ras',
    givenAt
  })) {
    data.append(key, value);
  }
  return data;
}

const PARSERS = [
  ['the log form', (data: FormData) => parseLogForm(data).givenAt],
  ['the entry edit form', (data: FormData) => parseEntryEditForm(data).givenAt],
  ['the meal edit form', (data: FormData) => parseMealEditForm(data, []).givenAt]
] as const;

// #485: production runs in UTC. A form posted without JavaScript sends its
// datetime-local value as typed, which the parent reads on Paris clocks; the
// JavaScript path sends an ISO instant. The missing and unparsable dates are
// in log.test.ts and edit.test.ts.
describe('givenAt on a server in UTC', () => {
  pinHostZone('UTC');

  describe.each(PARSERS)('in %s', (_, givenAt) => {
    it.each([
      ['a summer time (CEST)', '2026-06-01T12:30', '2026-06-01T10:30:00.000Z'],
      ['a winter time (CET)', '2026-01-15T12:30', '2026-01-15T11:30:00.000Z'],
      ['the skipped hour', '2026-03-29T02:30', '2026-03-29T01:30:00.000Z'],
      ['the repeated hour', '2026-10-25T02:30', '2026-10-25T00:30:00.000Z']
    ])('reads %s without a zone as Paris time', (_, value, iso) => {
      expect(givenAt(form(value)).toISOString()).toBe(iso);
    });

    it.each(['2026-06-01T10:30:00.000Z', '2026-06-01T12:30:00+02:00'])(
      'reads %s as that instant',
      (value) => {
        expect(givenAt(form(value)).toISOString()).toBe('2026-06-01T10:30:00.000Z');
      }
    );

    it('refuses a date that does not exist', () => {
      expect(() => givenAt(form('2026-02-30T10:00'))).toThrow(
        new RepasAbort(400, 'errorsLogDateInvalid')
      );
    });
  });
});
