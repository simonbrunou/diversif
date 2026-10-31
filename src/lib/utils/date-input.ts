import { browser } from '$app/env';
import { formatDateInputValue } from './dates';
import { formatParisDateTimeLocal, parseParisDateTimeLocal } from './paris-date';

// The zone of a repas form's <input type="datetime-local">. The server
// renders it on Paris clocks: its own zone is UTC in production, and it reads
// a form posted without JavaScript as Paris time (givenAtField). The browser
// renders its own zone, the one submitRepas converts from, so a parent
// outside France keeps their local time; hydration puts that value in the
// input (#485).

/** The value the input starts from, for `date`. */
export function dateInputValue(date: Date): string {
  return browser ? formatDateInputValue(date) : formatParisDateTimeLocal(date);
}

/** The instant a value of the input names, read in the zone it was rendered in. */
export function dateInputInstant(value: string): Date {
  return browser ? new Date(value) : parseParisDateTimeLocal(value);
}
