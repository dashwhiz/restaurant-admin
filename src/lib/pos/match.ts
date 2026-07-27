// Fuzzy name matching for POS imports. Normalizes names (keeping Cyrillic),
// then scores by shared words. Used to auto-link POS lines to recipes/products.

export function normName(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/\b(kg|g|ml|l|kom|por|lit|kgr|piece|чаша|порција|флаша|бр)\b/gi, '')
    .replace(/[^Ѐ-ӿa-z0-9\s]/gi, '') // keep Cyrillic + Latin letters + digits
    .replace(/\s+/g, ' ')
    .trim();
}

export interface Named {
  id: string;
  name: string;
}

/** Best match for `name` among `items`, or null if below the threshold. */
export function bestMatch<T extends Named>(
  name: string,
  items: T[],
  threshold = 0.4,
): { item: T; score: number } | null {
  const n = normName(name);
  if (!n) return null;
  const nWords = new Set(n.split(' ').filter((w) => w.length > 1));
  let best: T | null = null;
  let bestScore = 0;
  for (const it of items) {
    const h = normName(it.name);
    if (!h) continue;
    if (n === h) return { item: it, score: 1 };
    const hWords = new Set(h.split(' ').filter((w) => w.length > 1));
    let shared = 0;
    for (const w of nWords) if (hWords.has(w)) shared++;
    if (shared > 0) {
      const score = shared / Math.max(nWords.size, hWords.size, 1);
      if (score > bestScore) {
        bestScore = score;
        best = it;
      }
    }
  }
  return best && bestScore >= threshold ? { item: best, score: bestScore } : null;
}

/** A special order shows up as an article whose name contains this marker. */
export function isSpecialOrder(name: string): boolean {
  const n = (name || '').toLowerCase();
  return (
    n.includes('специјална нарачка') ||
    n.includes('специјална нарацка') ||
    n.includes('specijalna nara')
  );
}
