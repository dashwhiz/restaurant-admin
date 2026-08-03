# Data model

The app uses the **existing** Supabase database from the old HTML app. Types in
`src/lib/types.ts` mirror these tables exactly. Don't rename a column here
without changing the database too.

## Tables

### `products` — raw items / stock
`id`, `name`, `category`, `unit`, `current_stock`, `min_stock`,
`cost_per_unit`, `department` (`Бар`/`Кујна`), `created_at`.
Kalo columns (raw-prep loss only): `kalo_defrost`, `kalo_trim`,
`serving_size`, `serving_unit`. There is **no** `yield_pct` column — usable
yield is derived from the two kalo percentages.
See [`features/kalo.md`](./features/kalo.md).

### `recipes` — sellable items
`id`, `name`, `category`, `selling_price`, `price_updated_at`, `created_at`.

### `recipe_ingredients` — links a recipe to its products
`id`, `recipe_id`, `product_id`, `quantity`. Cascade-deletes with the recipe/product.

### `purchases` — deliveries in
`id`, `product_id`, `quantity`, `cost_per_unit`, `ddv_rate`, `price_with_ddv`,
`supplier`, `notes`, `created_at`.

### `sales` — items sold
`id`, `recipe_id`, `quantity` (integer), `notes`, `created_at`.

### `waste_log` — waste/spoilage out
`id`, `product_id`, `quantity`, `reason`, `created_at`.

### `stocktake_log` — physical counts
`id`, `product_id`, `system_qty`, `counted_qty`, `difference`, `created_at`.

### `events` — catering / special orders
`id`, `name`, `type`, `event_date`, `guest_count`, `price_per_person`,
`status` (`planned`/`done`), `notes`, `created_at`.

### `event_menu_items`
`id`, `event_id`, `recipe_id`, `course`, `qty_per_person`.

### `pos_imports` + `pos_sales_items` — daily POS sold-items imports
`pos_imports`: `id`, `import_date`, `filename`, `total_items`, `total_revenue`,
`total_gratis`, `matched_items`, `created_at`.
`pos_sales_items`: `id`, `import_id`, `sifra`, `name`, `unit`, `qty`, `amount`,
`gratis_qty`, `gratis_amount`, `recipe_id`, `matched`.

### `pos_mappings` — remembered POS matches
`id`, `sifra` (unique), `recipe_id`, `skip`, `created_at`.

Lets a šifra auto-match its recipe on the next import. Created 2026-07-27; it's
the only table this rewrite added — everything else predates it and came from the
old app.

## Row-Level Security

RLS is **on for every table**, with one policy granting full access to logged-in
(`authenticated`) users. The public anon key alone reads and writes nothing.

⚠️ **If you add a table, add it to the list in
[`supabase/rls.sql`](../supabase/rls.sql) and re-run that script.** The script
walks a hardcoded array, not the whole schema, so a new table is unprotected
until it's listed. Details in [`security.md`](./security.md).
