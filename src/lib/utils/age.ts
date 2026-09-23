import { parisDateParts, parisDayIndex } from './paris-date';
import * as m from '$lib/paraglide/messages';

function monthsLabel(months: number): string {
  return months === 1 ? m.childAgeMonthsOne() : m.childAgeMonthsOther({ months });
}

function daysLabel(days: number): string {
  return days === 1 ? m.childAgeDaysOne() : m.childAgeDaysOther({ days });
}

export function ageInMonths(birthDate: string, now: Date = new Date()): number {
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
  const { year, month, day } = parisDateParts(now.getTime());
  let months = (year - birthYear) * 12;
  months += month - birthMonth;
  if (day < birthDay) months -= 1;
  return Math.max(0, months);
}

export function formatAge(birthDate: string, now: Date = new Date()): string {
  const [birthYear, birthMonth, birthDay] = birthDate.split('-').map(Number);
  const birthDayIndex = Math.floor(Date.UTC(birthYear, birthMonth - 1, birthDay) / 86_400_000);
  const nowDayIndex = parisDayIndex(now.getTime());
  if (nowDayIndex < birthDayIndex) return m.childAgeFutureLabel();

  const months = ageInMonths(birthDate, now);

  // Day index of the birth date rolled forward by `months` — mirrors the
  // month-overflow semantics `Date#setUTCMonth` gave the previous
  // UTC-anchored implementation (e.g. 31 Jan + 1 month lands on 3 March),
  // now expressed purely in civil-day-index space so it stays consistent
  // with `nowDayIndex`, which is derived from the Paris civil day.
  const cursorDayIndex = Math.floor(
    Date.UTC(birthYear, birthMonth - 1 + months, birthDay) / 86_400_000
  );
  const days = nowDayIndex - cursorDayIndex;

  if (months < 1) {
    if (days <= 0) return m.childAgeTodayLabel();
    return daysLabel(days);
  }

  if (months >= 24) {
    const years = Math.floor(months / 12);
    const remainingMonths = months - years * 12;
    const yearsLabel = m.childAgeYears({ years });
    if (remainingMonths === 0) return yearsLabel;
    return m.childAgeJoiner({ first: yearsLabel, second: monthsLabel(remainingMonths) });
  }

  if (days === 0) return monthsLabel(months);
  return m.childAgeJoiner({ first: monthsLabel(months), second: daysLabel(days) });
}
