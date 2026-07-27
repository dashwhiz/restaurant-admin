// Recipes + their ingredients.
import { getSupabase } from '@/lib/supabase';
import type { Recipe, RecipeIngredient } from '@/lib/types';

export interface RecipeInput {
  name: string;
  category: string;
  selling_price: number;
}

export interface IngredientRow extends RecipeIngredient {
  product?: { name: string; unit: string; cost_per_unit: number } | null;
}

/** One ingredient as edited in the dialog (before it has a DB id). */
export interface IngredientDraft {
  product_id: string;
  quantity: number;
}

export async function listRecipes(): Promise<Recipe[]> {
  const { data, error } = await getSupabase()
    .from('recipes')
    .select('*')
    .order('category')
    .order('name');
  if (error) throw error;
  return (data ?? []) as Recipe[];
}

/** All ingredient links (with product info) — the list page groups these per recipe. */
export async function listAllIngredients(): Promise<IngredientRow[]> {
  const { data, error } = await getSupabase()
    .from('recipe_ingredients')
    .select('*, product:products(name,unit,cost_per_unit)');
  if (error) throw error;
  return (data ?? []) as IngredientRow[];
}

export async function createRecipe(input: RecipeInput): Promise<Recipe> {
  const { data, error } = await getSupabase().from('recipes').insert(input).select().single();
  if (error) throw error;
  return data as Recipe;
}

export async function updateRecipe(id: string, input: RecipeInput): Promise<void> {
  const { error } = await getSupabase().from('recipes').update(input).eq('id', id);
  if (error) throw error;
}

/** Update just the selling price (used by the bulk Prices page). */
export async function updateRecipePrice(id: string, price: number): Promise<void> {
  const { error } = await getSupabase()
    .from('recipes')
    .update({ selling_price: price, price_updated_at: new Date().toISOString() })
    .eq('id', id);
  if (error) throw error;
}

/**
 * Delete a recipe and everything referencing it. This also removes its sales
 * history (a destructive, confirmed action) — it does NOT reverse stock for
 * those old sales, same as the old app's "clear" behaviour.
 */
export async function deleteRecipe(id: string): Promise<void> {
  const sb = getSupabase();
  for (const table of ['recipe_ingredients', 'sales', 'pos_sales_items', 'event_menu_items']) {
    const { error } = await sb.from(table).delete().eq('recipe_id', id);
    if (error) throw error;
  }
  const { error } = await sb.from('recipes').delete().eq('id', id);
  if (error) throw error;
}

/** Replace a recipe's ingredient list wholesale. */
export async function setRecipeIngredients(recipeId: string, items: IngredientDraft[]): Promise<void> {
  const sb = getSupabase();
  const { error: delErr } = await sb.from('recipe_ingredients').delete().eq('recipe_id', recipeId);
  if (delErr) throw delErr;
  if (items.length) {
    const rows = items.map((i) => ({ recipe_id: recipeId, product_id: i.product_id, quantity: i.quantity }));
    const { error } = await sb.from('recipe_ingredients').insert(rows);
    if (error) throw error;
  }
}
