// Products data access. ALL Supabase queries for products live here — pages and
// components call these functions, never getSupabase() directly.
import { getSupabase } from '@/lib/supabase';
import type { Product } from '@/lib/types';

export type ProductInput = Omit<Product, 'id' | 'created_at'>;

export async function listProducts(): Promise<Product[]> {
  const { data, error } = await getSupabase()
    .from('products')
    .select('*')
    .order('category')
    .order('name');
  if (error) throw error;
  return (data ?? []) as Product[];
}

export async function createProduct(input: ProductInput): Promise<Product> {
  const { data, error } = await getSupabase()
    .from('products')
    .insert(input)
    .select()
    .single();
  if (error) throw error;
  return data as Product;
}

export async function updateProduct(id: string, input: Partial<ProductInput>): Promise<void> {
  const sb = getSupabase();
  // Typing a new "Тековна залиха" sets stock outright, like a count. Log it so
  // Историја shows it and a later normativ correction treats it as a fresh start.
  let previous: number | null = null;
  if (input.current_stock !== undefined) {
    const { data, error } = await sb.from('products').select('current_stock').eq('id', id).single();
    if (error) throw error;
    previous = Number(data.current_stock) || 0;
  }
  const { error } = await sb.from('products').update(input).eq('id', id);
  if (error) throw error;
  if (previous !== null && previous !== input.current_stock) {
    const { error: logErr } = await sb.from('stock_adjustments').insert({
      product_id: id,
      previous_qty: previous,
      new_qty: input.current_stock,
      reason: 'Рачна измена на залиха',
    });
    if (logErr) throw logErr;
  }
}

/** Save several minimum-stock values at once (from the Залиха / Попис table). */
export async function setMinStocks(changes: { id: string; min_stock: number }[]): Promise<void> {
  for (const c of changes) await updateProduct(c.id, { min_stock: c.min_stock });
}

/**
 * Delete a product and the rows that reference it. Child rows must go first or
 * the foreign-key constraints reject the delete (same as the old app).
 */
export async function deleteProduct(id: string): Promise<void> {
  const sb = getSupabase();
  for (const table of ['recipe_ingredients', 'purchases', 'waste_log', 'stocktake_log', 'stock_adjustments']) {
    const { error } = await sb.from(table).delete().eq('product_id', id);
    if (error) throw error;
  }
  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) throw error;
}
