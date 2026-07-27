// Destructive admin actions. Used for testing/reset. Guard with confirmations
// in the UI. See the Settings "danger zone".
import { getSupabase } from '@/lib/supabase';

const NIL = '00000000-0000-0000-0000-000000000000';

// FK-safe delete order: children before parents.
const ORDER = [
  'pos_sales_items',
  'pos_imports',
  'event_menu_items',
  'events',
  'stocktake_log',
  'waste_log',
  'sales',
  'purchases',
  'recipe_ingredients',
  'pos_mappings',
  'recipes',
  'products',
];

/** Delete ALL rows from every app table. Irreversible. */
export async function clearAllData(): Promise<void> {
  const sb = getSupabase();
  for (const table of ORDER) {
    const { error } = await sb.from(table).delete().neq('id', NIL);
    // Ignore tables that don't exist yet (e.g. pos_mappings before it's created).
    if (error && !/does not exist|could not find the table|relation/i.test(error.message)) {
      throw error;
    }
  }
}
