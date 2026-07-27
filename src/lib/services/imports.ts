// Applies parsed POS data to the database. Batched inserts and parallel updates
// keep large files fast. See docs/features/pos-import.md.
import { getSupabase } from '@/lib/supabase';
import type { Recipe, Product, PosMapping } from '@/lib/types';
import { bestMatch } from '@/lib/pos/match';
import type { ParsedItem, ParsedNormativ, ParsedPrice } from '@/lib/pos/parse';

const TABLE_MISSING = /does not exist|find the table|relation|schema cache/i;
// pos_mappings is optional (created by a one-time SQL step). Once we learn it's
// absent, stop hitting it — otherwise every import fires doomed requests.
let mappingsTableMissing = false;

// ── Šifrarnik (products + recipes) ──────────────────────────────
export async function importSifrarnik(
  products: ParsedItem[],
  recipes: ParsedItem[],
  opts: { doProducts: boolean; doRecipes: boolean },
): Promise<{ products: number; recipes: number }> {
  const sb = getSupabase();
  let pc = 0;
  let rc = 0;
  if (opts.doProducts) {
    for (let i = 0; i < products.length; i += 50) {
      const slice = products.slice(i, i + 50).map((p) => ({
        name: p.name, category: p.category, unit: p.unit, department: p.department,
        current_stock: 0, min_stock: 0, cost_per_unit: 0,
      }));
      const { error } = await sb.from('products').insert(slice);
      if (error) throw error;
      pc += slice.length;
    }
  }
  if (opts.doRecipes) {
    for (let i = 0; i < recipes.length; i += 50) {
      const slice = recipes.slice(i, i + 50).map((r) => ({ name: r.name, category: r.category, selling_price: 0 }));
      const { error } = await sb.from('recipes').insert(slice);
      if (error) throw error;
      rc += slice.length;
    }
  }
  return { products: pc, recipes: rc };
}

// ── Normativi (recipe → ingredient links) ───────────────────────
export async function importNormativi(
  parsed: ParsedNormativ[],
  dbRecipes: Recipe[],
  dbProducts: Product[],
): Promise<{ linked: number; newProducts: number }> {
  const sb = getSupabase();
  const matched = parsed
    .map((r) => ({ norm: r, recipe: bestMatch(r.name, dbRecipes) }))
    .filter((x): x is { norm: ParsedNormativ; recipe: { item: Recipe; score: number } } => !!x.recipe);

  // Resolve each unique ingredient name to a product id (fuzzy); create the rest.
  const resolved = new Map<string, string>();
  const toCreate = new Map<string, { name: string; unit: string }>();
  for (const { norm } of matched) {
    for (const ing of norm.ingredients) {
      const key = ing.name.toLowerCase();
      if (resolved.has(key) || toCreate.has(key)) continue;
      const pm = bestMatch(ing.name, dbProducts);
      if (pm) resolved.set(key, pm.item.id);
      else toCreate.set(key, { name: ing.name, unit: ing.unit });
    }
  }
  let newProducts = 0;
  const creates = [...toCreate.values()];
  for (let i = 0; i < creates.length; i += 50) {
    const slice = creates.slice(i, i + 50).map((v) => ({
      name: v.name, category: 'Суровина', unit: v.unit, department: 'Кујна',
      current_stock: 0, min_stock: 0, cost_per_unit: 0,
    }));
    const { data, error } = await sb.from('products').insert(slice).select();
    if (error) throw error;
    for (const p of data ?? []) resolved.set((p.name as string).toLowerCase(), p.id as string);
    newProducts += slice.length;
  }

  // Replace ingredients for all matched recipes.
  const recipeIds = matched.map((m) => m.recipe.item.id);
  for (let i = 0; i < recipeIds.length; i += 100) {
    const { error } = await sb.from('recipe_ingredients').delete().in('recipe_id', recipeIds.slice(i, i + 100));
    if (error) throw error;
  }
  const rows: { recipe_id: string; product_id: string; quantity: number }[] = [];
  let linked = 0;
  for (const { norm, recipe } of matched) {
    let any = false;
    for (const ing of norm.ingredients) {
      const pid = resolved.get(ing.name.toLowerCase());
      if (pid) {
        rows.push({ recipe_id: recipe.item.id, product_id: pid, quantity: ing.qty });
        any = true;
      }
    }
    if (any) linked++;
  }
  for (let i = 0; i < rows.length; i += 200) {
    const { error } = await sb.from('recipe_ingredients').insert(rows.slice(i, i + 200));
    if (error) throw error;
  }
  return { linked, newProducts };
}

// ── Cenovnik (recipe prices) ────────────────────────────────────
export async function importCenovnik(parsed: ParsedPrice[], dbRecipes: Recipe[]): Promise<{ updated: number }> {
  const sb = getSupabase();
  const matched = parsed
    .map((p) => ({ price: p.price, recipe: bestMatch(p.name, dbRecipes) }))
    .filter((x): x is { price: number; recipe: { item: Recipe; score: number } } => !!x.recipe);
  const ts = new Date().toISOString();
  let updated = 0;
  for (let i = 0; i < matched.length; i += 50) {
    const batch = matched.slice(i, i + 50);
    const results = await Promise.all(
      batch.map((x) => sb.from('recipes').update({ selling_price: x.price, price_updated_at: ts }).eq('id', x.recipe.item.id)),
    );
    const fail = results.find((r) => r.error);
    if (fail) throw fail.error;
    updated += batch.length;
  }
  return { updated };
}

// ── Daily sold items → sales ────────────────────────────────────
export interface DailySaleInput {
  recipeId: string;
  qty: number;
}
// Batched so the request count stays small no matter how many items a daily
// export has: one insert for all sales, then one read of every needed recipe's
// ingredients, one read of the affected products, and a single update per
// product. (The old per-item loop did a read+write per ingredient per item —
// hundreds of serial round-trips that could pin the browser.) Deleting an
// individual sale later still reverses its stock via the sales service, so this
// stays exactly reversible.
export async function importDaily(date: string, items: DailySaleInput[], deductStock: boolean): Promise<number> {
  const sb = getSupabase();
  if (items.length === 0) return 0;

  const rounded = items.map((it) => ({ recipeId: it.recipeId, qty: Math.round(it.qty) }));

  const { error: sErr } = await sb
    .from('sales')
    .insert(rounded.map((it) => ({ recipe_id: it.recipeId, quantity: it.qty, notes: `POS ${date}` })));
  if (sErr) throw sErr;

  if (deductStock) {
    const recipeIds = [...new Set(rounded.map((r) => r.recipeId))];
    const { data: ings, error: iErr } = await sb
      .from('recipe_ingredients')
      .select('recipe_id, product_id, quantity')
      .in('recipe_id', recipeIds);
    if (iErr) throw iErr;

    const byRecipe = new Map<string, { product_id: string; quantity: number }[]>();
    for (const ing of ings ?? []) {
      const list = byRecipe.get(ing.recipe_id as string) ?? [];
      list.push({ product_id: ing.product_id as string, quantity: Number(ing.quantity) || 0 });
      byRecipe.set(ing.recipe_id as string, list);
    }

    // Sum each product's total deduction across every sold recipe.
    const deltas = new Map<string, number>();
    for (const it of rounded) {
      for (const ing of byRecipe.get(it.recipeId) ?? []) {
        deltas.set(ing.product_id, (deltas.get(ing.product_id) ?? 0) - ing.quantity * it.qty);
      }
    }

    const productIds = [...deltas.keys()].filter((id) => deltas.get(id));
    if (productIds.length > 0) {
      const { data: prods, error: pErr } = await sb
        .from('products')
        .select('id, current_stock')
        .in('id', productIds);
      if (pErr) throw pErr;
      const stockById = new Map((prods ?? []).map((p) => [p.id as string, Number(p.current_stock) || 0]));

      for (let i = 0; i < productIds.length; i += 25) {
        const slice = productIds.slice(i, i + 25);
        const res = await Promise.all(
          slice.map((id) =>
            sb.from('products').update({ current_stock: (stockById.get(id) ?? 0) + (deltas.get(id) as number) }).eq('id', id),
          ),
        );
        const fail = res.find((r) => r.error);
        if (fail) throw fail.error;
      }
    }
  }

  return rounded.length;
}

// ── Persistent šifra → recipe mappings ──────────────────────────
export async function getMappings(): Promise<PosMapping[]> {
  if (mappingsTableMissing) return [];
  const { data, error } = await getSupabase().from('pos_mappings').select('*');
  if (error) {
    if (TABLE_MISSING.test(error.message)) {
      mappingsTableMissing = true; // table not created yet — stop trying
      return [];
    }
    throw error;
  }
  return (data ?? []) as PosMapping[];
}

export interface MappingInput {
  sifra: string;
  recipe_id: string | null;
  skip: boolean;
}

// One batched upsert instead of one request per row. No-op if pos_mappings is
// absent, so a missing optional table never floods the network.
export async function saveMappings(entries: MappingInput[]): Promise<void> {
  if (mappingsTableMissing || entries.length === 0) return;
  const { error } = await getSupabase().from('pos_mappings').upsert(entries, { onConflict: 'sifra' });
  if (error) {
    if (TABLE_MISSING.test(error.message)) mappingsTableMissing = true;
    else throw error;
  }
}
