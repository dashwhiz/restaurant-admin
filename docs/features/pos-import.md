# POS & file imports

The restaurant's POS exports several plain-text files. The app reads them and
maps them onto our data. All these files encode Macedonian Cyrillic in a 7-bit
scheme (symbols stand in for letters); decode them with the shared
`decodePOS()` before matching. See the old app for the validated symbol map:
`@ → Ж, [ → Ш, ] → Ќ, ^ → Ч, { → ш, } → ќ, ~ → ч, W → Њ, X → Џ, Q → Љ`
(+ base Latin → Cyrillic).

## File types

| File | Header contains | Becomes |
|---|---|---|
| `sitesifri` | `PODREDEN PO OSNOVNI SIFRI` | products (raw) + recipes (sold) |
| `prodaznisifri` | `PODREDEN PO PRODAZNI SIFRI` | recipes (sold items) |
| `normativi` | `LISTA NA NORMATIVI` | recipe → ingredient links |
| `cenovnik` | `CENOVNIK` | recipe selling prices |
| daily sold items | `LISTA NA PRODADENI ARTIKLI` | sales for a date |

**Import `sitesifri` (not both sitesifri + prodaznisifri)** — sitesifri already
produces products and recipes; importing prodaznisifri too duplicates recipes.

## Product vs recipe routing

An item is a **sold item → recipe** when its line ends with the ZS status flag
**`D`** (it also has a prodazna šifra + a `540xxx` punkt). Otherwise it's a
**raw product**. Do **not** use the `P` flag for this — `P` is unrelated, and
using it drops sold wines/spirits (the 0608/0609 bug).

## Daily sold-items import → sales

For each sold line, match its šifra/name to a recipe, then record a sale and
deduct stock through the recipe's ingredients (via the stock helpers). Round the
sale quantity **once** and use that same value for both the sale row and the
stock deduction, so it stays reversible.

### Remember manual matches (owner request)
When a line can't be auto-matched and the owner picks a recipe by hand, save the
choice in `pos_mappings` (`sifra → recipe_id`, or `skip = true`). Next import,
look up `pos_mappings` first so the same šifra is recognized automatically. Over
time the process becomes fully automatic.

### Matching UI (owner requests)
- A **search box** to filter products/recipes when matching by hand.
- A **"skip"** option in the match dropdown (stored as `skip = true` in
  `pos_mappings` so it's remembered).
- Ability to **re-open** a past import to fix wrong recipe matches.

### Special orders → Events
If a sold line's name contains `специјална нарачка` (handles the ц/ч spelling
and Latin `specijalna nara…`), classify it as a special order and offer to
create an **Event** (Настан) from it — prefilled name, date, guests from qty,
amount in notes — for the owner to complete.

## Invoice scanning (Anthropic Vision)

A photographed/scanned invoice is sent to Claude Vision, which returns line
items with per-line VAT (`ddv_rate`, `price_without_ddv`, `price_with_ddv`),
names kept in Macedonian (so they match products), supplier, and doc type. The
review screen auto-fills price-with-VAT from base × (1 + rate/100). Matched
items add stock + log a purchase; the base (без ДДВ) price is stored as
`cost_per_unit`. Requires `NEXT_PUBLIC_ANTHROPIC_API_KEY`.
