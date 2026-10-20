// Deliveries (purchases). Adding stock and reversing on edit/delete goes through
// the shared stock helper so quantities stay exactly reversible. See
// docs/features/stock.md.
import { getSupabase } from '@/lib/supabase';
import type { Purchase } from '@/lib/types';
import { applyStockDelta } from './stock';

export interface DeliveryRow extends Purchase {
  product?: { name: string; unit: string } | null;
}

export interface DeliveryInput {
  product_id: string;
  quantity: number;
  cost_per_unit: number;
  ddv_rate: number;
  price_with_ddv: number;
  supplier: string | null;
  notes: string | null;
}

export async function listDeliveries(): Promise<DeliveryRow[]> {
  const { data, error } = await getSupabase()
    .from('purchases')
    .select('*, product:products(name,unit)')
    .order('created_at', { ascending: false })
    .limit(300);
  if (error) throw error;
  return (data ?? []) as DeliveryRow[];
}

export async function createDelivery(input: DeliveryInput): Promise<void> {
  const { error } = await getSupabase().from('purchases').insert(input);
  if (error) throw error;
  await applyStockDelta(input.product_id, input.quantity);
  await refreshFromLatestDelivery(input.product_id);
}

/**
 * Set a product's VAT rate and cost to those of its latest delivery that has
 * them (0 is read as "not filled in", not as a real rate or price). Without the
 * cost, a hand-entered delivery left the product at 0 ден and every recipe using
 * it looked free (Лепинја). Best-effort on purpose: it runs after the delivery
 * and stock are saved, and throwing here would invite a second click that
 * saves the delivery — and adds the stock — twice.
 */
export async function refreshFromLatestDelivery(productId: string): Promise<void> {
  try {
    const sb = getSupabase();
    const latest = (column: 'ddv_rate' | 'cost_per_unit') =>
      sb
        .from('purchases')
        .select(column)
        .eq('product_id', productId)
        .gt(column, 0)
        .order('created_at', { ascending: false })
        .limit(1);
    const [rateRes, costRes] = await Promise.all([latest('ddv_rate'), latest('cost_per_unit')]);
    const rate = (rateRes.data?.[0] as { ddv_rate?: number } | undefined)?.ddv_rate;
    const cost = (costRes.data?.[0] as { cost_per_unit?: number } | undefined)?.cost_per_unit;
    const patch = { ...(rate != null ? { ddv_rate: rate } : {}), ...(cost != null ? { cost_per_unit: cost } : {}) };
    if (Object.keys(patch).length) await sb.from('products').update(patch).eq('id', productId);
  } catch {
    // The product just keeps its old values; the next delivery corrects them.
  }
}

/**
 * Save an edited delivery. If the product changed (Ајдамер entered instead of
 * Кашкавал), the old product gives back the old quantity and the new one gets
 * the new quantity; otherwise only the quantity difference moves.
 */
export async function updateDelivery(id: string, input: DeliveryInput): Promise<void> {
  const sb = getSupabase();
  const { data: old, error: oErr } = await sb
    .from('purchases')
    .select('product_id, quantity')
    .eq('id', id)
    .single();
  if (oErr) throw oErr;
  const oldProduct = old.product_id as string;
  const oldQty = Number(old.quantity) || 0;
  const { error } = await sb.from('purchases').update(input).eq('id', id);
  if (error) throw error;
  if (oldProduct === input.product_id) {
    await applyStockDelta(oldProduct, input.quantity - oldQty);
  } else {
    await applyStockDelta(oldProduct, -oldQty);
    await applyStockDelta(input.product_id, input.quantity);
    await refreshFromLatestDelivery(input.product_id);
  }
  await refreshFromLatestDelivery(oldProduct);
}

export async function deleteDelivery(id: string): Promise<void> {
  const sb = getSupabase();
  const { data: old, error: oErr } = await sb
    .from('purchases')
    .select('product_id, quantity')
    .eq('id', id)
    .single();
  if (oErr) throw oErr;
  const { error } = await sb.from('purchases').delete().eq('id', id);
  if (error) throw error;
  await applyStockDelta(old.product_id as string, -(Number(old.quantity) || 0));
  await refreshFromLatestDelivery(old.product_id as string);
}
