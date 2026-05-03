export function ageInMonths(birthDate: string, now: Date = new Date()): number {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  let months = (now.getUTCFullYear() - birth.getUTCFullYear()) * 12;
  months += now.getUTCMonth() - birth.getUTCMonth();
  if (now.getUTCDate() < birth.getUTCDate()) months -= 1;
  return Math.max(0, months);
}

export function formatAge(birthDate: string, now: Date = new Date()): string {
  const birth = new Date(`${birthDate}T00:00:00Z`);
  if (now < birth) return 'à venir';

  const months = ageInMonths(birthDate, now);

  const cursor = new Date(birth);
  cursor.setUTCMonth(cursor.getUTCMonth() + months);
  const days = Math.floor((now.getTime() - cursor.getTime()) / 86_400_000);

  if (months < 1) {
    if (days <= 0) return 'aujourd’hui';
    if (days === 1) return '1 jour';
    return `${days} jours`;
  }

  if (months >= 24) {
    const years = Math.floor(months / 12);
    const remainingMonths = months - years * 12;
    if (remainingMonths === 0) return `${years} ans`;
    return `${years} ans et ${remainingMonths} mois`;
  }

  const monthLabel = months === 1 ? 'mois' : 'mois';
  if (days === 0) return `${months} ${monthLabel}`;
  const dayLabel = days === 1 ? 'jour' : 'jours';
  return `${months} ${monthLabel} et ${days} ${dayLabel}`;
}
