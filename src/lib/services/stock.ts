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
 * Apply several signed deltas at once and log each in stock_adjustments with
 * `reason`, so the product's Историја shows what changed and why. Stock is
 * read fresh right before writing, like `applyStockDelta`.
 */
export async function applyLoggedStockDeltas(
  deltas: { productId: string; delta: number }[],
  reason: string,
): Promise<void> {
  const byId = new Map<string, number>();
  for (const d of deltas) if (d.delta) byId.set(d.productId, (byId.get(d.productId) ?? 0) + d.delta);
  const ids = [...byId.keys()];
  if (ids.length === 0) return;
  const sb = getSupabase();
  // Only products whose update really went through are logged, and they are
  // logged even if another one failed — so Историја always says what changed.
  const log: { product_id: string; previous_qty: number; new_qty: number; reason: string }[] = [];
  let failed: unknown = null;
  try {
    for (let i = 0; i < ids.length; i += 100) {
      const { data, error } = await sb.from('products').select('id, current_stock').in('id', ids.slice(i, i + 100));
      if (error) throw error;
      // allSettled, not all: every update in the batch has to finish (and be
      // logged) before deciding what happened.
      const res = await Promise.allSettled(
        (data ?? []).map(async (p) => {
          const prev = Number(p.current_stock) || 0;
          const next = prev + (byId.get(p.id as string) as number);
          const { error: upErr } = await sb.from('products').update({ current_stock: next }).eq('id', p.id);
          if (upErr) throw upErr;
          log.push({ product_id: p.id as string, previous_qty: prev, new_qty: next, reason });
        }),
      );
      const rejected = res.find((r) => r.status === 'rejected');
      if (rejected) throw (rejected as PromiseRejectedResult).reason;
    }
  } catch (e) {
    failed = e;
  }
  const { error: logErr } = log.length ? await sb.from('stock_adjustments').insert(log) : { error: null };
  if (failed || logErr) {
    const why = ((failed ?? logErr) as Error).message;
    throw new Error(`залихата е сменета за ${log.length} од ${ids.length} производи (${why}) — провери ја Историја`);
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
