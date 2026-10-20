// Stocktake: record a physical count and set stock to the counted value.
import { getSupabase } from '@/lib/supabase';
import { applyLoggedStockDeltas } from './stock';

export interface StocktakeEntry {
  product_id: string;
  system_qty: number;
  counted: number;
}

/**
 * Log each count and set current_stock to the counted amount. A count that
 * matches the system is logged too: it's still a confirmed real amount, which
 * a later normativ correction must not move (see normativ.ts).
 * `countedOn` (YYYY-MM-DD) dates the log rows; omit it to stamp the current
 * time. Only the log is dated — stock is always set to the count right away,
 * and `inserted_at` (DB default) records that moment.
 */
export async function submitStocktake(entries: StocktakeEntry[], countedOn?: string): Promise<number> {
  const sb = getSupabase();
  // Midday UTC, same as the POS import, so the day never shifts across time zones.
  const createdAt = countedOn ? { created_at: `${countedOn}T12:00:00Z` } : {};
  let updated = 0;
  for (const e of entries) {
    const diff = e.counted - e.system_qty;
    const { error: logErr } = await sb.from('stocktake_log').insert({
      product_id: e.product_id,
      system_qty: e.system_qty,
      counted_qty: e.counted,
      difference: diff,
      ...createdAt,
    });
    if (logErr) throw logErr;
    const { error } = await sb.from('products').update({ current_stock: e.counted }).eq('id', e.product_id);
    if (error) throw error;
    updated++;
  }
  return updated;
}

/** Reason of the stock_adjustments rows written by a control correction. */
export const CONTROL_REASON = 'Контролен попис';

/**
 * Control correction: add a signed amount to the current stock of a few
 * products (e.g. −6 Скопско poured at a group and never written down) instead
 * of setting it to a count. Logged in stock_adjustments so Историја shows it.
 * It's a delta on top of sales, not a count, so a later normativ correction
 * still covers the sales before it (see normativ.ts).
 */
export async function submitCorrections(entries: { product_id: string; delta: number }[]): Promise<number> {
  const deltas = entries.filter((e) => e.delta).map((e) => ({ productId: e.product_id, delta: e.delta }));
  await applyLoggedStockDeltas(deltas, CONTROL_REASON);
  return deltas.length;
}
