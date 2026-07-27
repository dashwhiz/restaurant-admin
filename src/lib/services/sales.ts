// Sales. Selling deducts a recipe's ingredients from stock; editing/deleting
// reverses through the same helper so stock stays exactly reversible.
import { getSupabase } from '@/lib/supabase';
import type { Sale } from '@/lib/types';
import { applyRecipeStock } from './stock';

export interface SaleRow extends Sale {
  recipe?: { name: string; category: string; selling_price: number } | null;
}

export interface SaleInput {
  recipe_id: string;
  quantity: number;
  notes: string | null;
}

export async function listSales(): Promise<SaleRow[]> {
  const { data, error } = await getSupabase()
    .from('sales')
    .select('*, recipe:recipes(name,category,selling_price)')
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
    .select('recipe_id, quantity')
    .eq('id', id)
    .single();
  if (oErr) throw oErr;
  const { error } = await sb.from('sales').update(input).eq('id', id);
  if (error) throw error;
  await applyRecipeStock(old.recipe_id as string, -(Number(old.quantity) || 0));
  await applyRecipeStock(input.recipe_id, input.quantity);
}

export async function deleteSale(id: string): Promise<void> {
  const sb = getSupabase();
  const { data: old, error: oErr } = await sb
    .from('sales')
    .select('recipe_id, quantity')
    .eq('id', id)
    .single();
  if (oErr) throw oErr;
  const { error } = await sb.from('sales').delete().eq('id', id);
  if (error) throw error;
  await applyRecipeStock(old.recipe_id as string, -(Number(old.quantity) || 0));
}
