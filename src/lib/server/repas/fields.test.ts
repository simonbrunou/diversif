import { afterEach, beforeEach, describe, expect, it } from 'bun:test';
import { RepasAbort } from './core';
import { parseEntryEditForm, parseLogForm, parseMealEditForm } from './fields';

function form(fields: Record<string, string>): FormData {
  const data = new FormData();
  for (const [key, value] of Object.entries(fields)) data.append(key, value);
  return data;
}

// What each parser needs besides the date: one aliment and a reaction.
const OTHER_FIELDS = { foodId: '1', reaction: 'ras', reactionLoaded: 'ras' };

const PARSERS = [
  ['the log form', (data: FormData) => parseLogForm(data).givenAt],
  ['the entry edit form', (data: FormData) => parseEntryEditForm(data).givenAt],
  ['the meal edit form', (data: FormData) => parseMealEditForm(data, []).givenAt]
] as const;

// #485: production runs in UTC. A form posted without JavaScript sends its
// datetime-local value as typed, which the parent reads on Paris clocks; the
// JavaScript path sends an ISO instant.
describe('givenAt on a server in UTC', () => {
  let hostZone: string | undefined;

  beforeEach(() => {
    hostZone = process.env.TZ;
    process.env.TZ = 'UTC';
  });

  afterEach(() => {
    if (hostZone === undefined) delete process.env.TZ;
    else process.env.TZ = hostZone;
  });

  describe.each(PARSERS)('in %s', (_, givenAt) => {
    it.each([
      ['a summer time (CEST)', '2026-06-01T12:30', '2026-06-01T10:30:00.000Z'],
      ['a winter time (CET)', '2026-01-15T12:30', '2026-01-15T11:30:00.000Z'],
      ['the skipped hour', '2026-03-29T02:30', '2026-03-29T01:30:00.000Z'],
      ['the repeated hour', '2026-10-25T02:30', '2026-10-25T00:30:00.000Z']
    ])('reads %s without a zone as Paris time', (_, value, iso) => {
      expect(givenAt(form({ ...OTHER_FIELDS, givenAt: value })).toISOString()).toBe(iso);
    });

    it.each(['2026-06-01T10:30:00.000Z', '2026-06-01T12:30:00+02:00'])(
      'reads %s as that instant',
      (value) => {
        expect(givenAt(form({ ...OTHER_FIELDS, givenAt: value })).toISOString()).toBe(
          '2026-06-01T10:30:00.000Z'
        );
      }
    );

    it.each([
      ['', 'errorsLogDateRequired'],
      ['not-a-date', 'errorsLogDateInvalid'],
      ['2026-02-30T10:00', 'errorsLogDateInvalid']
    ])('refuses %p with %s', (value, errorKey) => {
      const refusal = (() => {
        try {
          givenAt(form({ ...OTHER_FIELDS, givenAt: value }));
        } catch (error) {
          return error;
        }
      })();
      expect(refusal).toBeInstanceOf(RepasAbort);
      expect((refusal as RepasAbort).errorKey).toBe(errorKey);
    });
  });
});
