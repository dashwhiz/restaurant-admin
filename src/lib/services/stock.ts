// Shared stock mutation helpers. EVERY change to products.current_stock goes
// through here so edits/deletes are exactly reversible. See docs/features/stock.md.
import { getSupabase } from '@/lib/supabase';

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
