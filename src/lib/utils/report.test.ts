import { afterEach, describe, expect, it } from 'bun:test';
import { baseLocale, overwriteGetLocale } from '$lib/paraglide/runtime';
import { reportReactionIcon, reportReactionClass, formatReportDay } from './report';
import { CheckCircle2, AlertCircle, OctagonAlert } from 'lucide-svelte';

describe('reportReactionIcon', () => {
  it('maps each reaction id to its icon', () => {
    expect(reportReactionIcon('ras')).toBe(CheckCircle2);
    expect(reportReactionIcon('inconfort')).toBe(AlertCircle);
    expect(reportReactionIcon('reaction')).toBe(OctagonAlert);
  });
});

describe('reportReactionClass', () => {
  it('maps each reaction id to its color class', () => {
    expect(reportReactionClass('ras')).toBe('text-reaction-ras-foreground');
    expect(reportReactionClass('inconfort')).toBe('text-reaction-inconfort-foreground');
    expect(reportReactionClass('reaction')).toBe('text-reaction-reaction-foreground');
  });
});

describe('formatReportDay', () => {
  afterEach(() => {
    overwriteGetLocale(() => baseLocale);
  });

  const ts = new Date('2026-03-01T12:00:00Z').getTime();

  it('formats with the French long-date style when locale is fr', () => {
    overwriteGetLocale(() => 'fr');
    expect(formatReportDay(ts)).toMatch(/mars/i);
  });

  it('formats with the en-GB style when locale is en', () => {
    overwriteGetLocale(() => 'en');
    expect(formatReportDay(ts)).toMatch(/Mar/i);
  });
});
