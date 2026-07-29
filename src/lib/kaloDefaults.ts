// Researched typical yield-loss starting points for common raw ingredients.
// Only ever used to pre-fill a SUGGESTION for a product that has no Кало
// values set yet (both null) — never overwrites a value the owner already
// entered, and still requires the normal Кало page save to take effect.
// See docs/features/kalo.md.
//
// Sources (July 2026): USDA cooking-yield tables, Culinary Institute of
// America / Christian Chefs International / Chefs Resources yield charts,
// and published meat-thawing drip-loss studies (ScienceDirect). Poultry
// assumes boneless/skinless as bought; cucumbers assume peeled (Lira's prep
// for shopska/makedonska/таратор/cucumber-ring salads) — adjust per product
// if the actual cut or prep differs.
import { normName } from './pos/match';

interface KaloDefault {
  keywords: string[]; // matched as a substring of the normalized product name
  defrost: number; // % — thawing/drip loss (0 for fresh produce)
  trim: number; // % — cleaning/peeling/trimming loss
}

const DEFAULTS: KaloDefault[] = [
  // Poultry (boneless, skinless)
  { keywords: ['пилешко', 'пилешки', 'chicken'], defrost: 4, trim: 5 },
  // Beef
  { keywords: ['говедско', 'телешко', 'beef'], defrost: 2, trim: 20 },
  // Pork
  { keywords: ['свинско', 'pork'], defrost: 8, trim: 15 },
  // Fish (whole-to-fillet average — varies a lot by species)
  { keywords: ['риба', 'лосос', 'пастрмка', 'fish', 'salmon'], defrost: 0, trim: 45 },
  // Vegetables — fresh, no defrost step
  { keywords: ['домат', 'tomato'], defrost: 0, trim: 9 },
  { keywords: ['краставиц', 'cucumber'], defrost: 0, trim: 27 },
  { keywords: ['кромид', 'onion'], defrost: 0, trim: 11 },
  { keywords: ['компир', 'potato'], defrost: 0, trim: 22 },
  { keywords: ['морков', 'carrot'], defrost: 0, trim: 18 },
  { keywords: ['пиперк', 'pepper'], defrost: 0, trim: 20 },
  { keywords: ['зелк', 'cabbage'], defrost: 0, trim: 21 },
  { keywords: ['лук', 'garlic'], defrost: 0, trim: 13 },
  { keywords: ['марул', 'зелена салата', 'lettuce'], defrost: 0, trim: 26 },
];

export function suggestKalo(productName: string): { defrost: number; trim: number } | null {
  const n = normName(productName);
  if (!n) return null;
  for (const d of DEFAULTS) {
    if (d.keywords.some((k) => n.includes(normName(k)))) return { defrost: d.defrost, trim: d.trim };
  }
  return null;
}
