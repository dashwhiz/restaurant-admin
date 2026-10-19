// Parsers for the LYRA POS export files. Pure functions: text in, structured
// data out. Names are decoded to Cyrillic; category/department classification
// runs on the RAW (Latin-keyword) text. See docs/features/pos-import.md.
import { cleanPOSName } from './decode';

export type PosFormat = 'sitesifri' | 'prodazni' | 'normativi' | 'cenovnik' | 'daily' | 'unknown';

export interface ParsedItem {
  name: string;
  category: string;
  unit: string;
  department: 'Бар' | 'Кујна';
}
export interface SifrarnikResult {
  products: ParsedItem[];
  recipes: ParsedItem[];
}
export interface ParsedNormativ {
  name: string;
  unit: string;
  ingredients: { name: string; qty: number; unit: string }[];
}
export interface ParsedPrice {
  name: string;
  price: number;
}
export interface ParsedDaily {
  date: string;
  /** qty = paid portions; gratis = free ones (GRATIS + Pansion), which still leave stock. */
  items: { sifra: string; name: string; unit: string; qty: number; amount: number; gratis: number }[];
}

const UNIT_MAP: Record<string, string> = {
  KGR: 'kg', LIT: 'L', KOM: 'piece', POR: 'portion', KIT: 'piece', NIZ: 'piece', MKD: 'piece', PAR: 'piece',
};

export function detectFormat(text: string): PosFormat {
  const top = text.split(/\r?\n/).slice(0, 12).join('\n');
  if (top.includes('PODREDEN PO PRODAZNI SIFRI')) return 'prodazni';
  if (top.includes('SIFRARNIK NA ARTIKLI')) return 'sitesifri';
  if (top.includes('LISTA NA NORMATIVI')) return 'normativi';
  if (top.includes('LISTA NA PRODADENI ARTIKLI')) return 'daily';
  if (top.includes('CENOVNIK')) return 'cenovnik';
  return 'unknown';
}

function deptFromCode(code: string, rawCat: string): 'Бар' | 'Кујна' {
  const n = parseInt(code, 10);
  const u = rawCat.toUpperCase();
  if (n >= 200 && n < 500) return 'Бар';
  if (/RAKIJA|PIVO|VIN|PIJALOC|ALKOHOL|SPIRIT|KAFE/.test(u)) return 'Бар';
  return 'Кујна';
}
function recipeCat(rawCat: string): string {
  const u = rawCat.toUpperCase();
  if (/KAFE|^AJ|NAPITAK|TOPLI/.test(u)) return 'Пијалок';
  if (/DESERT|TORT|SLADOLED|SLATKARSKI/.test(u)) return 'Десерт';
  if (/SALATA|PREDJ|APETIS/.test(u)) return 'Предјадење';
  if (/RAKIJA|PIVO|VIN|PIJALOC|ALKOHOL|KOKTEL|NAPITOC/.test(u)) return 'Пијалок';
  return 'Храна';
}

// sitesifri / prodaznisifri — sold items (ZS flag "D") become recipes, the rest products.
export function parseSifrarnik(text: string): SifrarnikResult {
  const ITEM_RE = /^(\d{6})\s+(?:\d{3,5}\s+)?(P\s+)?(\d{4})\s+(.+?)\s+(KGR|LIT|KOM|POR|KIT|NIZ|MKD|PAR)/;
  const UNITS = Object.keys(UNIT_MAP);
  const products: ParsedItem[] = [];
  const recipes: ParsedItem[] = [];
  const seenP = new Set<string>();
  const seenR = new Set<string>();
  let cat = 'Општо';
  let catRaw = 'Општо';
  let dept: 'Бар' | 'Кујна' = 'Кујна';

  for (const raw of text.split(/\r?\n/)) {
    const s = raw.trim();
    if (!s || s.startsWith('=') || s.startsWith('Sifra') || s.startsWith('-')) continue;

    const first = s.split(/\s+/)[0];
    // Category header: 1–5 digit code, no unit on the line.
    if (/^\d{1,5}$/.test(first)) {
      const hasUnit = UNITS.some((u) => s.includes(' ' + u + ' ') || s.endsWith(u));
      if (!hasUnit) {
        let rest = s.slice(first.length).trim();
        const rp = rest.split(/\s+/);
        if (rp[0] && /^0\d{3}$/.test(rp[0])) rest = rp.slice(1).join(' ');
        rest = rest.replace(/\s*\d{6}\s*$/, '').replace(/^-+|-+$/g, '').trim();
        if (rest.length > 2) {
          catRaw = rest;
          cat = cleanPOSName(rest).slice(0, 50);
          dept = deptFromCode(first, rest);
        }
        continue;
      }
    }

    const m = ITEM_RE.exec(s);
    if (!m) continue;
    const isSale = /\sD$/.test(s); // ZS status flag "D" = sold → recipe
    const name = cleanPOSName(m[4].trim());
    const unit = UNIT_MAP[m[5]] || 'piece';
    const key = name.toLowerCase();
    if (!key) continue;

    if (isSale) {
      if (!seenR.has(key)) {
        seenR.add(key);
        recipes.push({ name, category: recipeCat(catRaw), unit, department: dept });
      }
    } else if (!seenP.has(key)) {
      seenP.add(key);
      products.push({ name, category: cat, unit, department: dept });
    }
  }
  return { products, recipes };
}

const UNIT_CONV: Record<string, [string, number]> = {
  gr: ['kg', 1 / 1000], GR: ['kg', 1 / 1000], Gr: ['kg', 1 / 1000],
  ml: ['L', 1 / 1000], ML: ['L', 1 / 1000], Ml: ['L', 1 / 1000],
  KGR: ['kg', 1], LIT: ['L', 1], KOM: ['piece', 1], POR: ['portion', 1], KIT: ['piece', 1], NIZ: ['piece', 1],
  // The export is inconsistent about case; without these a header unit like
  // "kgr" isn't recognised and gets glued onto the name ("Телешка салата кгр").
  kgr: ['kg', 1], lit: ['L', 1], kom: ['piece', 1], por: ['portion', 1],
};

const KNOWN_UNITS = new Set(Object.keys(UNIT_CONV));

/**
 * The unit token of an ingredient line, or null when the export didn't give a
 * usable one.
 *
 * One line reads "PRASE^KA IZNUTRICA  0.2000  220" — a typo where the unit
 * belongs. ING_LINE captures that as the unit, and an unrecognised token used
 * to travel all the way into `products.unit`, leaving a product measured in
 * "220". Anything the POS doesn't define is treated as no unit at all, exactly
 * like a line that omits one. ING_LINE still matches `\w+` on purpose: refusing
 * digits there makes the qty capture swallow "220" instead, turning 0.2 into 220.
 */
const posUnit = (u: string | null): string | null => (u && KNOWN_UNITS.has(u) ? u : null);

/** One line of a normativ, still pointing at whatever šifra the export named. */
interface RawIngredientRef {
  sifra: string;
  name: string;
  qty: number;
  /** The raw POS unit token, or null when the line carried no unit. */
  unit: string | null;
}
interface RawBlock {
  name: string;
  /** Header unit — the amount one "batch" of this block yields. */
  unit: string;
  ingredients: RawIngredientRef[];
}

function parseNormativiBlocks(text: string): Map<string, RawBlock> {
  const REC_HDR = /^\s{4,6}(\d{6})\s{5,}(.+?)\s*$/;
  const ING_LINE = /^\s+(\d{1,3})\s+(\d{6})\s+(P\s+)?(.+?)\s+([\d.]+)(?:\s+(\w+))?\s*$/;
  const blocks = new Map<string, RawBlock>();
  let cur: RawBlock | null = null;

  for (const raw of text.split(/\r?\n/)) {
    const t = raw.replace(/\s+$/, '');
    const trimmed = t.trim();
    if (!trimmed || trimmed.startsWith('=') || trimmed.startsWith('-')) continue;

    const hm = REC_HDR.exec(t);
    if (hm) {
      // The unit is right-aligned with a wide gap before it, but prepared
      // sub-items used only as ingredients (e.g. "Брускети") have no unit at
      // all. Without this, a header with no unit fails to match, and its
      // ingredient lines get silently attached to the previous recipe instead.
      const parts = hm[2].split(/\s{2,}/).filter(Boolean);
      let unit = 'KOM';
      let name = hm[2];
      if (parts.length > 1 && KNOWN_UNITS.has(parts[parts.length - 1])) {
        unit = parts.pop()!;
        name = parts.join(' ');
      }
      cur = { name: name.trim(), unit, ingredients: [] };
      blocks.set(hm[1], cur);
      continue;
    }
    if (!cur) continue;
    const im = ING_LINE.exec(t);
    if (!im) continue;
    cur.ingredients.push({
      sifra: im[2],
      name: im[4].trim(),
      qty: parseFloat(im[5]),
      unit: im[6]?.trim() || null,
    });
  }
  return blocks;
}

/**
 * How many batches of `block` are meant by "use `qty` `unit` of it".
 * A dish asking for 200 gr of Мајонез, whose own normativ yields 1 KGR, needs
 * 0.2 of that normativ. When the units aren't comparable (or the line carried
 * none) the quantity is already a count of batches, so it passes through.
 */
function batchesOf(qty: number, unit: string | null, blockUnit: string): number {
  if (!unit) return qty;
  const [refCanon, refMult] = UNIT_CONV[unit] ?? [unit, 1];
  const [blockCanon, blockMult] = UNIT_CONV[blockUnit] ?? [blockUnit, 1];
  if (refCanon !== blockCanon || !blockMult) return qty;
  return (qty * refMult) / blockMult;
}

/**
 * Resolve one normativ down to raw ingredients only.
 *
 * Nearly half the recipes are built from other prepared items — Плескавица is
 * "200 gr of Мелено месо" and Мелено месо is itself a normativ. Those
 * references are followed here (by šifra, because names repeat: there are two
 * different "Руска салата"), so a recipe ends up pointing only at things that
 * are really bought. Left unresolved they became zero-cost phantom products and
 * every dish using one under-reported its cost.
 */
function expandBlock(
  sifra: string,
  blocks: Map<string, RawBlock>,
  seen: Set<string>,
): { sifra: string; name: string; qty: number; unit: string }[] {
  const block = blocks.get(sifra);
  if (!block || seen.has(sifra)) return []; // `seen` also stops a cyclic export
  const nested = new Set(seen).add(sifra);

  // Keyed by šifra and held in canonical units (kg/L/piece), so the same
  // product reached twice — Руска салата's own eggs plus the eggs inside its
  // мајонез — sums correctly even when the two lines used different units.
  const merged = new Map<string, { sifra: string; name: string; qty: number; unit: string }>();
  const add = (row: { sifra: string; name: string; qty: number; unit: string }, scale: number) => {
    const prev = merged.get(row.sifra);
    if (prev) prev.qty += row.qty * scale;
    else merged.set(row.sifra, { ...row, qty: row.qty * scale });
  };

  for (const ing of block.ingredients) {
    const tok = posUnit(ing.unit);
    const sub = blocks.get(ing.sifra);
    if (sub) {
      const scale = batchesOf(ing.qty, tok, sub.unit);
      for (const inner of expandBlock(ing.sifra, blocks, nested)) add(inner, scale);
    } else if (ing.name) {
      // A real purchased product; blank-name lines have nothing to link to.
      const [unit, mult] = tok ? UNIT_CONV[tok] : ['piece', 1];
      add({ sifra: ing.sifra, name: ing.name, qty: ing.qty * mult, unit }, 1);
    }
  }
  return [...merged.values()];
}

export function parseNormativi(text: string): ParsedNormativ[] {
  const blocks = parseNormativiBlocks(text);
  const out: ParsedNormativ[] = [];
  for (const [sifra, block] of blocks) {
    out.push({
      name: cleanPOSName(block.name),
      unit: block.unit,
      ingredients: expandBlock(sifra, blocks, new Set()).map((ing) => ({
        name: cleanPOSName(ing.name),
        qty: parseFloat(ing.qty.toFixed(6)),
        unit: ing.unit,
      })),
    });
  }
  return out;
}

export function parseCenovnik(text: string): ParsedPrice[] {
  const blocks = text.split('ARTIKAL:');
  const parsed: ParsedPrice[] = [];
  for (const block of blocks.slice(1)) {
    const lines = block.split('\n');
    const hm = lines[0]?.match(/^\s*(\d+)\s+(.+?)(?:\s+KOM|\s*$)/i);
    if (!hm) continue;
    // Only strip a recognizable serving-size descriptor (a decoded POS symbol
    // word like "чаша"/"глас" followed by a pour size, e.g. "Амаро ~aša 0.040").
    // A bare trailing number is often part of the actual article name for
    // wines/spirits sold by bottle size (e.g. "Бовин 0.2", "Тероар Тиквеш 0.7")
    // — stripping it collapsed distinct bottle sizes into one name and broke
    // matching against the recipe list.
    const rawName = hm[2]
      .replace(/\s+[\x00-\x1f\x80-\xff~`^{[\\"]\S*\s*[\d.]*\s*$/, '')
      .trim();
    const name = cleanPOSName(rawName);
    if (!name) continue;
    let price = 0;
    for (const line of lines.slice(1, 30)) {
      if (line.includes('KATEGORIJA 1')) {
        const nums = line.match(/\d+\.\d{2}/g);
        if (nums) {
          price = parseFloat(nums[0]);
          break;
        }
      }
    }
    if (price > 0) parsed.push({ name, price });
  }
  return parsed;
}

// Column layout of the daily report, as [start, end) character offsets. The
// file's own "--- ------ ---…" ruler line is used when present; this copy of it
// is only a fallback.
const DAILY_COLS: [number, number][] = [
  [0, 3], [4, 10], [11, 41], [42, 45], [46, 56], [57, 69], [70, 80], [81, 93], [94, 100], [101, 113], [114, 124], [125, 137],
];

export function parseDaily(text: string): ParsedDaily {
  const lines = text.split(/\r?\n/);
  let date = new Date().toISOString().slice(0, 10);
  for (const line of lines.slice(0, 15)) {
    const m = line.match(/OD\s+(\d{2})\.(\d{2})\.(\d{2})/);
    if (m) {
      date = `20${m[3]}-${m[2]}-${m[1]}`;
      break;
    }
  }

  // Read by column position, not by picking numbers out of the line. The
  // GRATIS and Pansion quantities are printed without decimals ("11", not
  // "11.000") and any column can be blank, so "the first two decimals" missed
  // every free portion and stock came out too high. Blank columns are also why
  // articles with no unit (e.g. "BRUSKETI") need nothing special here.
  const ruler = lines.find((l) => /^-{3} -{6} -+/.test(l));
  const cols = ruler ? [...ruler.matchAll(/-+/g)].map((m): [number, number] => [m.index, m.index + m[0].length]) : DAILY_COLS;
  if (cols.length < 12) return { date, items: [] };
  const num = (line: string, col: number) => parseFloat(line.slice(cols[col][0], cols[col][1])) || 0;

  const seen: Record<string, ParsedDaily['items'][number]> = {};
  for (const line of lines) {
    if (!line.startsWith('DEN ')) continue;
    const sifra = line.slice(cols[1][0], cols[1][1]).trim();
    if (!/^\d{6}$/.test(sifra)) continue;
    // Don't strip a trailing bottle/pour size (e.g. "Скопско 0.33" vs "Скопско
    // 0.5") — it's the part of the name that distinguishes otherwise-identical
    // recipes, and the recipe list keeps it too.
    const name = cleanPOSName(line.slice(cols[2][0], cols[2][1]).trim());
    const unit = UNIT_MAP[line.slice(cols[3][0], cols[3][1]).trim()] || 'piece';
    const qty = num(line, 4);
    const amount = num(line, 5);
    // Pansion (board) portions leave the kitchen unpaid too, so they count as gratis.
    const gratis = num(line, 6) + num(line, 8);
    if (!qty && !gratis) continue;
    if (seen[sifra]) {
      seen[sifra].qty += qty;
      seen[sifra].amount += amount;
      seen[sifra].gratis += gratis;
    } else {
      seen[sifra] = { sifra, name, unit, qty, amount, gratis };
    }
  }
  return { date, items: Object.values(seen) };
}
