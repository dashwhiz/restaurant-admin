-- Row-Level Security for a public deploy.
--
-- Run this ONCE in Supabase → SQL Editor when you're ready to put the app on a
-- public URL (GitHub Pages). It turns RLS ON for every table and allows access
-- only to a logged-in ("authenticated") user. After this, the public anon key
-- alone can read/write NOTHING — a bot that finds the site is locked out.
--
-- You must also create a login user (Supabase → Authentication → Users → Add
-- user) and set NEXT_PUBLIC_REQUIRE_AUTH=true in the deployed build (the
-- GitHub Actions workflow already does this). See docs/deploy.md.
--
-- Local development keeps RLS off (or you can turn it on and log in locally);
-- the app only forces login when NEXT_PUBLIC_REQUIRE_AUTH=true.

do $$
declare
  t text;
  tables text[] := array[
    'products', 'recipes', 'recipe_ingredients', 'purchases', 'sales',
    'waste_log', 'stocktake_log', 'events', 'event_menu_items',
    'pos_imports', 'pos_sales_items', 'pos_mappings', 'scan_mappings'
  ];
begin
  foreach t in array tables loop
    -- skip tables that don't exist yet (e.g. pos_mappings before you create it)
    if to_regclass(t) is null then
      continue;
    end if;
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists "authenticated full access" on %I', t);
    execute format(
      'create policy "authenticated full access" on %I for all to authenticated using (true) with check (true)',
      t
    );
  end loop;
end $$;
