// Stocktake: record a physical count and set stock to the counted value.
import { getSupabase } from '@/lib/supabase';

export interface StocktakeEntry {
  product_id: string;
  system_qty: number;
  counted: number;
}

/** Log each non-zero difference and set current_stock to the counted amount. */
export async function submitStocktake(entries: StocktakeEntry[]): Promise<number> {
  const sb = getSupabase();
  let updated = 0;
  for (const e of entries) {
    const diff = e.counted - e.system_qty;
    if (diff === 0) continue;
    const { error: logErr } = await sb.from('stocktake_log').insert({
      product_id: e.product_id,
      system_qty: e.system_qty,
      counted_qty: e.counted,
      difference: diff,
    });
    if (logErr) throw logErr;
    const { error } = await sb.from('products').update({ current_stock: e.counted }).eq('id', e.product_id);
    if (error) throw error;
    updated++;
  }
  return updated;
}
