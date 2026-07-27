# Stock (the reversibility rule)

`products.current_stock` is a running total. Deliveries add to it; sales, waste,
POS imports and completed events subtract from it. In the old app the #1 source
of bugs was that **editing or deleting** one of those records didn't undo its
original effect, so stock slowly drifted away from reality.

## The rule

**Every stock change must be exactly reversible.**

- **Add** (delivery): `current_stock += qty`.
- **Edit** (delivery qty 10 → 4): reverse the old, apply the new →
  `current_stock += (4 − 10)`.
- **Delete** (delivery of 4): `current_stock -= 4`.
- Sales/waste are the same idea with the opposite sign, and a sale reverses
  through **all** of the recipe's ingredients.

To make reversal exact:
- Always read the current value **fresh from the DB** right before writing (don't
  trust a value the page loaded earlier).
- Store the quantity you actually applied, and reverse using that stored value.
- **Do not clamp at zero.** Stock is allowed to go negative — it's a real signal
  ("sold more than the system knew") and clamping makes deletes un-reversible.

## Where it lives

All stock math goes through one service, `src/lib/services/stock.ts`
(helpers like `applyStockDelta(productId, delta)` and
`applyRecipeStock(recipeId, multiplier)`), so every feature reverses the same
way. Features never write `current_stock` directly.

## Note on transactions

Supabase JS can't wrap multiple statements in one transaction from the browser,
so a row insert and its stock update are separate calls. For this single-user
local app that's acceptable; on error we surface it and re-load so the screen
reflects the real DB. If this ever needs to be bulletproof, move the stock
change into a Postgres function (RPC) and call that once.
