export function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/[’']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function fuzzyMatch(query: string, target: string): boolean {
  const q = normalize(query);
  if (!q) return true;
  const t = normalize(target);
  if (t.includes(q)) return true;

  let ti = 0;
  for (const ch of q) {
    const found = t.indexOf(ch, ti);
    if (found === -1) return false;
    ti = found + 1;
  }
  return true;
}
