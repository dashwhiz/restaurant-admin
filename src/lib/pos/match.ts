// Fuzzy name matching for POS imports. Normalizes names (keeping Cyrillic),
// then scores by shared words. Used to auto-link POS lines to recipes/products.

/**
 * Loose normalisation for *display and lookup*: search boxes filter with it, and
 * its exact output is stored as `scan_mappings.line_key`. Changing what it
 * returns orphans every remembered invoice line, so matching uses its own
 * tokeniser (`matchTokens`) instead of tightening this.
 */
export function normName(s: string): string {
  return (s || '')
    .toLowerCase()
    .replace(/\b(kg|g|ml|l|kom|por|lit|kgr|piece|чаша|порција|флаша|бр)\b/gi, '')
    .replace(/[^Ѐ-ӿa-z0-9\s]/gi, '') // keep Cyrillic + Latin letters + digits
    .replace(/\s+/g, ' ')
    .trim();
}

// Units of sale, which say nothing about *which* item this is. They occur in
// hundreds of names, so letting them count towards a match made "Пирошка парче"
// and "Пита парче" look half identical.
//
// Only units belong here. A word naming a *form* must not: "Сладолед кугла" (a
// scoop) is priced separately from "Сладолед порција", and listing "кугла" made
// the two indistinguishable.
const GENERIC_WORDS = new Set([
  'kg', 'g', 'gr', 'ml', 'l', 'lit', 'kgr', 'kom', 'por', 'kit', 'niz', 'piece', 'pcs',
  'кг', 'гр', 'мл', 'л', 'лит', 'ком', 'пор', 'кгр',
  'порција', 'порции', 'парче', 'парчиња', 'чаша', 'флаша', 'бр',
]);

/**
 * Tokens used for scoring a match.
 *
 * A token is a half portion ("1/2"), a decimal size ("0.75"), or a run of
 * letters. Each of those distinctions is load-bearing:
 *
 *  - reading "1/2" whole stops it collapsing to "12", which used to match the
 *    "12" in "Виски-балантајн 12" and price a whisky at 80 denars;
 *  - sizes really do separate "Скопско 0.33" from "Скопско 0.5";
 *  - single letters are kept, because "Шампињони С." and "Шампињони М." are
 *    different items and that letter is the only thing telling them apart.
 */
export function matchTokens(s: string): string[] {
  const out: string[] = [];
  const found = (s || '').toLowerCase().match(/\d+\s*\/\s*\d+|\d+(?:[.,]\d+)?|[a-zЀ-ӿ]+/g) ?? [];
  for (const t of found) {
    if (t.includes('/')) {
      out.push(t.replace(/\s+/g, '')); // "1 / 2" and "1/2" are the same portion
    } else if (/^\d/.test(t)) {
      const n = parseFloat(t.replace(',', '.'));
      if (Number.isFinite(n)) out.push(String(n)); // 0.040 and 0.04 are one size
    } else if (!GENERIC_WORDS.has(t)) {
      out.push(t);
    }
  }
  return out;
}

// An import compares every source line against every recipe, so the same names
// are tokenised thousands of times. The set of names in play is small and fixed
// for the life of a page, so remembering them keeps a large import responsive.
const tokenCache = new Map<string, Set<string>>();
function tokenSet(s: string): Set<string> {
  let cached = tokenCache.get(s);
  if (!cached) {
    cached = new Set(matchTokens(s));
    tokenCache.set(s, cached);
  }
  return cached;
}

const isSize = (t: string) => /^\d/.test(t);

/**
 * A stated size is an identity, not a hint: "Сан Пелегрино 0.25л" and "Сан
 * Пелегрино 0.75л" are different bottles, and share enough words to otherwise
 * pass the threshold. Names still agree when one simply doesn't state a size,
 * which is the common case ("Ред Бул 0.200" against a plain "Ред Бул").
 */
function sizesAgree(a: Set<string>, b: Set<string>): boolean {
  const aSizes = [...a].filter(isSize);
  const bSizes = [...b].filter(isSize);
  if (aSizes.length === 0 || bSizes.length === 0) return true;
  // Whichever states fewer sizes must have all of them present in the other.
  const [fewer, richer] = aSizes.length <= bSizes.length ? [aSizes, b] : [bSizes, a];
  return fewer.every((size) => richer.has(size));
}

export interface Named {
  id: string;
  name: string;
}

/**
 * Best match for `name` among `items`, or null when nothing is convincing.
 *
 * A wrong match is worse than no match: it silently prices a dish from another
 * dish, or gives it someone else's ingredients. So this errs towards returning
 * null and leaving the row for a human.
 */
export function bestMatch<T extends Named>(
  name: string,
  items: T[],
  // Measured against the restaurant's own exports: below this, real mismatches
  // creep in ("Шатобријан … за 2 особи" onto "Тел. коленица за 2 особи"); above
  // it, correct two-of-three-word matches like "Ред Бул 0.200" start to be lost.
  threshold = 0.65,
): { item: T; score: number } | null {
  const n = tokenSet(name);
  if (n.size === 0) return null;
  let best: T | null = null;
  let bestScore = 0;
  let ambiguous = false;
  for (const it of items) {
    const h = tokenSet(it.name);
    if (h.size === 0 || !sizesAgree(n, h)) continue;
    let shared = 0;
    for (const w of n) if (h.has(w)) shared++;
    if (shared === 0) continue;
    const score = shared / Math.max(n.size, h.size);
    if (score === 1) return { item: it, score: 1 };
    if (score > bestScore) {
      bestScore = score;
      best = it;
      ambiguous = false;
    } else if (score === bestScore && best && it.name !== best.name) {
      ambiguous = true;
    }
  }
  if (!best || bestScore < threshold) return null;
  // Two different items fit equally well — guessing would be wrong half the
  // time, so report nothing and let the owner decide.
  return ambiguous ? null : { item: best, score: bestScore };
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
