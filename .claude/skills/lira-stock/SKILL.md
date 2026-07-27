---
name: lira-stock
description: Use whenever a change touches product stock (current_stock) — deliveries, sales, waste, POS imports, events, or any add/edit/delete that affects inventory quantities. Enforces the reversibility rule that prevents stock drift.
---

# Stock changes must be exactly reversible

`products.current_stock` is a running total. The #1 bug in the old app was
edits/deletes not undoing their original stock effect, causing permanent drift.

**Rules — follow all of them:**

1. All stock math goes through `src/lib/services/stock.ts`
   (`applyStockDelta`, `applyRecipeStock`). Never write `current_stock`
   directly from a feature.
2. **Add** applies the delta; **edit** reverses the old value then applies the
   new; **delete** reverses the stored value. A sale reverses through every
   recipe ingredient.
3. Read the current value **fresh from the DB** right before writing.
4. Store the quantity actually applied and reverse using that stored value
   (e.g. round a POS qty once, use the same rounded number for the sale row and
   the deduction).
5. **Do not clamp at zero** — negative stock is allowed and required for exact
   reversal.

Full rationale: `docs/features/stock.md`. After a stock-touching change, verify
by doing add → edit → delete in the running app and confirming stock returns to
its starting value.
