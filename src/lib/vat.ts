// ДДВ (VAT). Pure helpers — no React, no Supabase.
//
// What is stored where:
//  - product cost_per_unit and purchase cost_per_unit are WITHOUT VAT;
//  - recipe selling_price and event price_per_person are WITH VAT (what the
//    till charges).
// Profit and margin are always worked out without VAT on both sides — VAT is
// passed on to the state, it is not earnings. The "Со ДДВ" switch only
// changes which version of a price or cost is shown.

export const VAT_RATES = [0, 5, 10, 18] as const;

/** A product's purchase VAT: the rate of its last delivery, else a guess by
 *  department (most kitchen goods are 5%, bar goods 18%). */
export function productVatRate(p: { ddv_rate?: number | null; department?: string | null }): number {
  return p.ddv_rate ?? (p.department === 'Бар' ? 18 : 5);
}

/** A recipe's sales VAT: food and non-alcoholic drinks 10%, alcohol 18%. */
export function recipeVatRate(r: { ddv_rate?: number | null; category?: string | null }): number {
  return r.ddv_rate ?? (r.category === 'Пијалок' ? 18 : 10);
}

/** Catering is 5%; any other event is served in the restaurant at 10%. */
export function eventVatRate(type: string | null | undefined): number {
  return type === 'Кетеринг' ? 5 : 10;
}

export const addVat = (net: number, rate: number) => net * (1 + rate / 100);
export const removeVat = (gross: number, rate: number) => gross / (1 + rate / 100);

/** A value stored WITHOUT VAT (a cost), as the switch wants it shown. */
export const shownCost = (withVat: boolean, net: number, rate: number) => (withVat ? addVat(net, rate) : net);
/** A value stored WITH VAT (a selling price), as the switch wants it shown. */
export const shownPrice = (withVat: boolean, gross: number, rate: number) =>
  withVat ? gross : removeVat(gross, rate);
