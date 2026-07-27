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
}

// The product isn't editable in the edit form, so only the quantity delta matters.
export async function updateDelivery(id: string, input: DeliveryInput): Promise<void> {
  const sb = getSupabase();
  const { data: old, error: oErr } = await sb
    .from('purchases')
    .select('product_id, quantity')
    .eq('id', id)
    .single();
  if (oErr) throw oErr;
  const { error } = await sb.from('purchases').update(input).eq('id', id);
  if (error) throw error;
  await applyStockDelta(old.product_id as string, input.quantity - (Number(old.quantity) || 0));
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
}
