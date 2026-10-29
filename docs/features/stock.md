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

## Events (Настани)

An event moves stock only once it is **completed**; a planned event's menu is
just a plan. Stock taken = menu qty per guest × guests × the recipe's normativ.
All in `src/lib/services/events.ts`.

- **Complete (✓):** marks the event done first — only if it isn't already —
  then deducts. A second click or a stale page gets "Настанот е веќе завршен"
  and deducts nothing. (Before 2026-10-29 every OK deducted again: Мекици was
  taken 2×, Експириенс Балкан 3×; the extra was given back, logged as
  `Двојно завршен настан: …`.)
- **Edit a completed event:** reads the old guests and menu fresh, saves, then
  per recipe applies new − old portions (unchanged rows skipped). More guests
  or portions take the extra; fewer give it back; a removed row gives back all.
  Price, date and notes don't touch stock.
- **Delete a completed event:** gives back guests × menu as saved — exactly
  what is deducted, thanks to the edit rule above.
- **Open bar** events are done from the start with no menu: the drinks come in
  with the gratis sales, so the event moves no stock.
- A recipe with no normativ deducts nothing.

## When a normativ changes

A sale deducts its recipe's ingredients as they are at that moment, but deleting
the sale later reverses the recipe as it is **now**. So changing a normativ
after sales breaks reversal unless the past deductions are corrected too.

`src/lib/services/normativ.ts` works out that correction: per product,
`−(new per portion − old per portion) × portions`, over sales (paid and gratis)
and completed events of the changed recipes. Only portions that took stock
**after the product's stock was last set outright** count — a stocktake (also
one that matched the system, which is now logged), "Нулирај залиха", or a hand
edit of Тековна залиха (logged as `Рачна измена на залиха`) — because that value
already held the real amount. "After" compares when stock actually moved:
`sales.inserted_at`, `events.completed_at`, `stocktake_log.inserted_at`, not the
business-day `created_at` (yesterday's POS file is imported after this
morning's count). Sales with `stock_deducted = false` (imported without
"Одземи од залиха") are skipped, and editing/deleting them no longer moves
stock either. Applied through `applyLoggedStockDeltas`, logged in
`stock_adjustments` as `Норматив сменет: …`; Историја lists those rows with no
amount of its own, since its sale lines already use today's recipe.

- Recipe dialog: shows the correction and asks — **Зачувај и поправи залиха**
  (the old normativ was wrong) or **Само зачувај** (the recipe changes from
  today; old sales stay as they were and won't reverse exactly).
- Normativi import: checkbox, on by default.
- A **control correction** (Залиха / Попис → "Корекција +/−", logged as
  `Контролен попис`) is a delta on top of sales, not a count, so it does not
  move the cutoff.
- Known limit: rows from before 2026-10-19 have `inserted_at` backfilled from
  `created_at` (their real save time wasn't recorded).

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
