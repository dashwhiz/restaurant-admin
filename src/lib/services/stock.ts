// Shared stock mutation helpers. EVERY change to products.current_stock goes
// through here so edits/deletes are exactly reversible. See docs/features/stock.md.
import { getSupabase } from '@/lib/supabase';
import { fetchAllRows } from './paged';

/**
 * Apply a signed delta to a product's stock. Reads the current value fresh from
 * the DB (never trusts a stale cached value), writes the new value.
 * Positive delta adds stock; negative removes. Stock may go negative on purpose.
 */
export async function applyStockDelta(productId: string, delta: number): Promise<void> {
  if (!productId || !delta) return;
  const sb = getSupabase();
  const { data, error } = await sb
    .from('products')
    .select('current_stock')
    .eq('id', productId)
    .single();
  if (error) throw error;
  const next = (Number(data?.current_stock) || 0) + delta;
  const { error: upErr } = await sb.from('products').update({ current_stock: next }).eq('id', productId);
  if (upErr) throw upErr;
}

/**
 * Adjust stock for every ingredient of a recipe. Positive multiplier deducts
 * (a sale of `multiplier` units); negative adds back (reversing that sale).
 */
export async function applyRecipeStock(recipeId: string, multiplier: number): Promise<void> {
  if (!recipeId || !multiplier) return;
  const { data, error } = await getSupabase()
    .from('recipe_ingredients')
    .select('product_id, quantity')
    .eq('recipe_id', recipeId);
  if (error) throw error;
  for (const ing of data ?? []) {
    await applyStockDelta(ing.product_id as string, -(Number(ing.quantity) || 0) * multiplier);
  }
}

/**
 * Set every product's stock to 0. Used from Settings after history has been
 * cleared, since clearing removes rows without reversing their stock effect.
 * Each zeroed product gets a stock_adjustments row so its history shows the
 * reset and what the stock was before. Returns how many products changed.
 */
export async function resetAllStock(): Promise<number> {
  const sb = getSupabase();
  const all = await fetchAllRows<{ id: string; current_stock: number }>('products', {
    select: 'id, current_stock',
  });
  const nonZero = all.filter((p) => Number(p.current_stock) !== 0);
  if (nonZero.length === 0) return 0;

  const ids = nonZero.map((p) => p.id);
  for (let i = 0; i < ids.length; i += 200) {
    const { error } = await sb.from('products').update({ current_stock: 0 }).in('id', ids.slice(i, i + 200));
    if (error) throw error;
  }

  const { error: logErr } = await sb.from('stock_adjustments').insert(
    nonZero.map((p) => ({
      product_id: p.id,
      previous_qty: Number(p.current_stock) || 0,
      new_qty: 0,
      reason: 'Нулирај залиха',
    })),
  );
  if (logErr) throw logErr;
  return nonZero.length;
}
