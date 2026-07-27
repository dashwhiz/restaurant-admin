# Data model

The app uses the **existing** Supabase database from the old HTML app. Types in
`src/lib/types.ts` mirror these tables exactly. Don't rename a column here
without changing the database too.

## Tables

### `products` — raw items / stock
`id`, `name`, `category`, `unit`, `current_stock`, `min_stock`,
`cost_per_unit`, `department` (`Бар`/`Кујна`), `created_at`.
Kalo columns (raw-prep loss only): `yield_pct`, `kalo_defrost`, `kalo_trim`,
`serving_size`, `serving_unit`. See [`features/kalo.md`](./features/kalo.md).

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

## New table to add: `pos_mappings`

For "remember manual POS matches" (so a šifra auto-matches its recipe next time).
Run this once in Supabase → **SQL Editor**:

```sql
create table if not exists pos_mappings (
  id uuid default gen_random_uuid() primary key,
  sifra text not null unique,
  recipe_id uuid references recipes(id) on delete cascade,
  skip boolean default false,
  created_at timestamptz default now()
);
alter table pos_mappings disable row level security;
```

## Row-Level Security

RLS is currently **disabled** on all tables (matching the old app). This is only
acceptable for local use. See [`security.md`](./security.md) before any public
deploy.
