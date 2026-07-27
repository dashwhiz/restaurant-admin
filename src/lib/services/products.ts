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
  const { error } = await getSupabase().from('products').update(input).eq('id', id);
  if (error) throw error;
}

/**
 * Delete a product and the rows that reference it. Child rows must go first or
 * the foreign-key constraints reject the delete (same as the old app).
 */
export async function deleteProduct(id: string): Promise<void> {
  const sb = getSupabase();
  for (const table of ['recipe_ingredients', 'purchases', 'waste_log', 'stocktake_log']) {
    const { error } = await sb.from(table).delete().eq('product_id', id);
    if (error) throw error;
  }
  const { error } = await sb.from('products').delete().eq('id', id);
  if (error) throw error;
}
