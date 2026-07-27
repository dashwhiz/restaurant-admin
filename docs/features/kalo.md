# Kalo / Krš (yield loss)

"Кало / крш" is the loss you get preparing raw ingredients — meat loses weight
defrosting and trimming, vegetables lose weight when cleaned, some stock breaks
or spoils.

## The decision (from the owner)

- **Do NOT apply kalo during cooking / food-cost.** The recipes come from the
  restaurant's *normativi*, and those quantities are already the gross amount
  taken from stock. Multiplying by a yield factor there would double-count.
- **DO track kalo for raw prep**, so we can see, per product, how much is lost:
  - defrosting frozen → thawed (`kalo_defrost` %)
  - trimming / butchering (`kalo_trim` %) — especially meat, also vegetables
  - a resulting usable **yield %** (`yield_pct`)

So kalo is a **reference / planning tool on the product**, not a multiplier in
recipe cost.

## Data

On `products`: `yield_pct`, `kalo_defrost`, `kalo_trim` (all percentages).
`yield_pct` is roughly `(1 − defrost%) × (1 − trim%) × 100`.

## The Кало page

Lists products (mainly meat/veg) with editable defrost% and trim%, shows the
computed usable yield, and lets the owner record real measured practice
("bought 1 kg frozen → 0.72 kg usable after defrost + trim"). It must **not**
feed into `calcFoodCost` or stock deduction.

## Food cost

`food cost of a recipe = Σ (ingredient.quantity × product.cost_per_unit)`.
No kalo factor. (This was explicitly wrong in the old app and is corrected here.)
