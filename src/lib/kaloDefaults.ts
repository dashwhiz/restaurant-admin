// Researched typical yield-loss starting points for common raw ingredients.
// Only ever used to pre-fill a SUGGESTION for a product that has no Кало
// values set yet (both null) — never overwrites a value the owner already
// entered, and still requires the normal Кало page save to take effect.
// See docs/features/kalo.md.
//
// Sources: the owner's reference table "Кало/Крш Референца (Лира)" — general
// culinary yield/trim references (USDA, US Foods, Chefs Resources, standard
// culinary math), per cut rather than per animal. Fish and lettuce aren't in
// that table and keep the earlier researched figures (CIA / Christian Chefs
// yield charts). These are industry averages: the real number depends on the
// supplier, the season and how the kitchen cuts — measure in-weight against
// out-weight for the 10–15 highest-volume items and enter the real figure.
import { normName } from './pos/match';

interface KaloDefault {
  // Matched against the normalized product name. A keyword of several words
  // matches when ALL of them appear, in any order ("телеш бифтек" matches both
  // "Телешки бифтек" and "Бифтек телешко"), so cuts can be told apart from the
  // animal. Stems, not whole words, to survive Macedonian endings.
  keywords: string[];
  defrost: number; // % — thawing/drip loss (0 for fresh produce)
  trim: number; // % — cleaning/peeling/trimming loss
}

// Order matters: the first match wins, so every specific cut sits above the
// generic fallback for its animal.
const DEFAULTS: KaloDefault[] = [
  // Chicken
  { keywords: ['пилеш гради', 'пилеш филе', 'chicken breast'], defrost: 5, trim: 7 },
  { keywords: ['пилеш бут', 'пилеш батак', 'chicken thigh'], defrost: 5, trim: 10 },
  { keywords: ['пилеш крил', 'chicken wing'], defrost: 5, trim: 5 },
  { keywords: ['пилеш џигер', 'пилеш дроб'], defrost: 4, trim: 10 },
  { keywords: ['пилеш', 'пиле', 'chicken'], defrost: 5, trim: 6 }, // whole/other

  // Veal
  { keywords: ['телеш бифтек', 'телеш филе'], defrost: 5, trim: 12 },
  { keywords: ['телеш котлет'], defrost: 5, trim: 18 },
  { keywords: ['телеш ребр'], defrost: 5, trim: 20 },
  { keywords: ['телеш гулаш', 'телеш коцк'], defrost: 5, trim: 5 },
  { keywords: ['телеш', 'veal'], defrost: 5, trim: 12 },

  // Beef
  { keywords: ['говед бифтек', 'говед филе', 'beef tenderloin'], defrost: 5, trim: 18 },
  { keywords: ['говед стек', 'антрекот', 'рибај', 'ribeye'], defrost: 5, trim: 12 },
  { keywords: ['говед ребр'], defrost: 5, trim: 22 },
  { keywords: ['говед гулаш', 'говед коцк'], defrost: 5, trim: 6 },
  { keywords: ['говед мелен'], defrost: 3, trim: 5 },
  { keywords: ['говед', 'beef'], defrost: 5, trim: 12 },

  // Pork
  { keywords: ['свин бут'], defrost: 5, trim: 10 },
  { keywords: ['свин котлет'], defrost: 5, trim: 18 },
  { keywords: ['свин каре'], defrost: 5, trim: 10 },
  { keywords: ['свин врат', 'вратно'], defrost: 5, trim: 12 },
  { keywords: ['панцет', 'потрбушин'], defrost: 4, trim: 6 },
  { keywords: ['свинско', 'свински', 'pork'], defrost: 5, trim: 12 },

  // Fish — not in the reference table; whole-to-fillet average, varies a lot
  // by species.
  { keywords: ['риба', 'лосос', 'пастрмка', 'fish', 'salmon'], defrost: 0, trim: 45 },

  // Vegetables — fresh, no defrost step
  { keywords: ['кромид', 'onion'], defrost: 0, trim: 10 },
  { keywords: ['чеснок', 'бел лук', 'garlic'], defrost: 0, trim: 13 },
  { keywords: ['морков', 'carrot'], defrost: 0, trim: 20 },
  { keywords: ['компир', 'potato'], defrost: 0, trim: 22 },
  { keywords: ['домат', 'tomato'], defrost: 0, trim: 10 },
  { keywords: ['краставиц', 'cucumber'], defrost: 0, trim: 16 },
  { keywords: ['пиперк', 'pepper'], defrost: 0, trim: 25 },
  { keywords: ['патлиџан', 'eggplant'], defrost: 0, trim: 19 },
  { keywords: ['тиквич', 'zucchini'], defrost: 0, trim: 22 },
  { keywords: ['зелк', 'cabbage'], defrost: 0, trim: 21 },
  { keywords: ['спанаќ', 'spinach'], defrost: 0, trim: 28 },
  { keywords: ['целер', 'celery'], defrost: 0, trim: 25 },
  { keywords: ['праз', 'leek'], defrost: 0, trim: 25 },
  { keywords: ['печурк', 'шампињон', 'mushroom'], defrost: 0, trim: 10 },
  { keywords: ['марул', 'зелена салата', 'lettuce'], defrost: 0, trim: 26 },
  // Shelling loss — only for fresh peas in the pod, never frozen/tinned.
  { keywords: ['грашок свеж'], defrost: 0, trim: 60 },

  // Fruit
  { keywords: ['јаболк', 'apple'], defrost: 0, trim: 24 },
  { keywords: ['портокал', 'orange'], defrost: 0, trim: 53 },
  { keywords: ['лимон', 'lemon'], defrost: 0, trim: 60 },
  { keywords: ['банана', 'banana'], defrost: 0, trim: 34 },
  { keywords: ['дињ', 'melon'], defrost: 0, trim: 52 },
  { keywords: ['лубениц', 'watermelon'], defrost: 0, trim: 48 },
  { keywords: ['праск', 'peach'], defrost: 0, trim: 24 },
  { keywords: ['кајси', 'apricot'], defrost: 0, trim: 9 },
  { keywords: ['грозј', 'grape'], defrost: 0, trim: 4 },
  { keywords: ['круш', 'pear'], defrost: 0, trim: 22 },
];

export function suggestKalo(productName: string): { defrost: number; trim: number } | null {
  const n = normName(productName);
  if (!n) return null;
  const matches = (keyword: string) =>
    normName(keyword)
      .split(' ')
      .every((word) => word && n.includes(word));
  for (const d of DEFAULTS) {
    if (d.keywords.some(matches)) return { defrost: d.defrost, trim: d.trim };
  }
  return null;
}
