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

async function wipe(tables: string[]): Promise<void> {
  const sb = getSupabase();
  for (const table of tables) {
    const { error } = await sb.from(table).delete().neq('id', NIL);
    // Ignore tables that don't exist yet (e.g. pos_mappings before it's created).
    if (error && !/does not exist|could not find the table|relation/i.test(error.message)) {
      throw error;
    }
  }
}

/** Delete ALL rows from every app table. Irreversible. */
export async function clearAllData(): Promise<void> {
  return wipe(ORDER);
}

// Clearing one area at a time — the usual case is a POS import that went wrong,
// where nuking the whole database is a wildly disproportionate fix. Each entry
// lists its child tables first so foreign keys don't reject the delete.
export const CLEARABLE = [
  { key: 'pos', label: 'POS увози', tables: ['pos_sales_items', 'pos_imports'] },
  { key: 'sales', label: 'Продажби', tables: ['sales'] },
  { key: 'purchases', label: 'Испораки', tables: ['purchases'] },
  { key: 'waste', label: 'Отпад', tables: ['waste_log'] },
  { key: 'stocktake', label: 'Попис', tables: ['stocktake_log'] },
  { key: 'events', label: 'Настани', tables: ['event_menu_items', 'events'] },
  {
    key: 'recipes',
    label: 'Рецепти (и состојки)',
    tables: ['recipe_ingredients', 'pos_mappings', 'recipes'],
  },
  {
    key: 'products',
    label: 'Производи (и сè поврзано)',
    tables: ['recipe_ingredients', 'purchases', 'waste_log', 'stocktake_log', 'products'],
  },
] as const;

export type ClearableKey = (typeof CLEARABLE)[number]['key'];

/** Delete one area. Does NOT touch stock elsewhere — it removes rows outright. */
export async function clearSection(key: ClearableKey): Promise<void> {
  const section = CLEARABLE.find((s) => s.key === key);
  if (!section) throw new Error(`Непозната секција: ${key}`);
  return wipe([...section.tables]);
}
