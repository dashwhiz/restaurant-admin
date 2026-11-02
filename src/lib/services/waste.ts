// Waste log. Removing stock and reversing on edit/delete via the shared helper.
import { getSupabase } from '@/lib/supabase';
import { fetchAllRows } from './paged';
import type { WasteLog } from '@/lib/types';
import { applyStockDelta } from './stock';

export interface WasteRow extends WasteLog {
  product?: { name: string; unit: string; cost_per_unit: number; ddv_rate: number | null; department: string } | null;
}

export interface WasteInput {
  product_id: string;
  quantity: number;
  reason: string;
}

export async function listWaste(): Promise<WasteRow[]> {
  // All rows, newest first. A fixed limit hid older days without saying so
  // (Испораки stopped halfway through 20.10, Продажби before 25.10).
  const rows = await fetchAllRows<WasteRow>('waste_log', { select: '*, product:products(name,unit,cost_per_unit,ddv_rate,department)' });
  return rows.sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
}

export async function createWaste(input: WasteInput): Promise<void> {
  const { error } = await getSupabase().from('waste_log').insert(input);
  if (error) throw error;
  await applyStockDelta(input.product_id, -input.quantity);
}

// Product can change here, so return the old amount to the old product and take
// the new amount from the new one.
export async function updateWaste(id: string, input: WasteInput): Promise<void> {
  const sb = getSupabase();
  const { data: old, error: oErr } = await sb
    .from('waste_log')
    .select('product_id, quantity')
    .eq('id', id)
    .single();
  if (oErr) throw oErr;
  const { error } = await sb.from('waste_log').update(input).eq('id', id);
  if (error) throw error;
  await applyStockDelta(old.product_id as string, Number(old.quantity) || 0);
  await applyStockDelta(input.product_id, -input.quantity);
}

export async function deleteWaste(id: string): Promise<void> {
  const sb = getSupabase();
  const { data: old, error: oErr } = await sb
    .from('waste_log')
    .select('product_id, quantity')
    .eq('id', id)
    .single();
  if (oErr) throw oErr;
  const { error } = await sb.from('waste_log').delete().eq('id', id);
  if (error) throw error;
  await applyStockDelta(old.product_id as string, Number(old.quantity) || 0);
}
