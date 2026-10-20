// Sales. Selling deducts a recipe's ingredients from stock; editing/deleting
// reverses through the same helper so stock stays exactly reversible.
import { getSupabase } from '@/lib/supabase';
import type { Sale } from '@/lib/types';
import { applyRecipeStock } from './stock';

export interface SaleRow extends Sale {
  recipe?: { name: string; category: string; selling_price: number; ddv_rate: number | null } | null;
}

export interface SaleInput {
  recipe_id: string;
  quantity: number;
  notes: string | null;
}

/**
 * What a sale brought in, with VAT: the till's amount when the import saved one
 * (so discounts match the till), otherwise quantity × the recipe's price.
 * Gratis brings nothing.
 */
export function saleAmount(
  s: Pick<Sale, 'quantity' | 'is_gratis' | 'amount'>,
  sellingPrice: number | null | undefined,
): number {
  if (s.is_gratis) return 0;
  if (s.amount != null) return Number(s.amount) || 0;
  return (Number(s.quantity) || 0) * (sellingPrice ?? 0);
}

export async function listSales(): Promise<SaleRow[]> {
  const { data, error } = await getSupabase()
    .from('sales')
    .select('*, recipe:recipes(name,category,selling_price,ddv_rate)')
    .order('created_at', { ascending: false })
    .limit(500);
  if (error) throw error;
  return (data ?? []) as SaleRow[];
}

export async function createSale(input: SaleInput): Promise<void> {
  const { error } = await getSupabase().from('sales').insert(input);
  if (error) throw error;
  await applyRecipeStock(input.recipe_id, input.quantity);
}

export async function updateSale(id: string, input: SaleInput): Promise<void> {
  const sb = getSupabase();
  const { data: old, error: oErr } = await sb
    .from('sales')
    .select('recipe_id, quantity, stock_deducted, amount')
    .eq('id', id)
    .single();
  if (oErr) throw oErr;
  // Keep the till's amount in step: same recipe → scale it to the new
  // quantity; another recipe → drop it and fall back to that recipe's price.
  const oldQty = Number(old.quantity) || 0;
  const amount =
    old.amount == null || input.recipe_id !== old.recipe_id || oldQty <= 0
      ? null
      : Math.round((Number(old.amount) * input.quantity * 100) / oldQty) / 100;
  const { error } = await sb.from('sales').update({ ...input, amount }).eq('id', id);
  if (error) throw error;
  // A sale imported without deducting stock stays that way when edited.
  if (old.stock_deducted === false) return;
  await applyRecipeStock(old.recipe_id as string, -(Number(old.quantity) || 0));
  await applyRecipeStock(input.recipe_id, input.quantity);
}

export async function deleteSale(id: string): Promise<void> {
  const sb = getSupabase();
  const { data: old, error: oErr } = await sb
    .from('sales')
    .select('recipe_id, quantity, stock_deducted')
    .eq('id', id)
    .single();
  if (oErr) throw oErr;
  const { error } = await sb.from('sales').delete().eq('id', id);
  if (error) throw error;
  // Nothing to give back if it never took any (imported without deducting).
  if (old.stock_deducted === false) return;
  await applyRecipeStock(old.recipe_id as string, -(Number(old.quantity) || 0));
}
