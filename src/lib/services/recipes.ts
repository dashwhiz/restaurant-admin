// Recipes data access. (Ingredient wiring is added when the recipes page grows.)
import { getSupabase } from '@/lib/supabase';
import type { Recipe } from '@/lib/types';

export async function listRecipes(): Promise<Recipe[]> {
  const { data, error } = await getSupabase()
    .from('recipes')
    .select('*')
    .order('category')
    .order('name');
  if (error) throw error;
  return (data ?? []) as Recipe[];
}
