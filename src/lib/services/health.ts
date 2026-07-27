// Read-only diagnostics for the Settings page: how many rows each table holds
// and whether the invoice-scanner Edge Function answers. Nothing here writes.
import { getSupabase } from '@/lib/supabase';

export interface TableCount {
  table: string;
  label: string;
  /** null when the table couldn't be read (missing, or blocked by RLS). */
  count: number | null;
}

// Labelled for the UI. admin.ts has its own list ordered for FK-safe deletes —
// different purpose, so the small repeat is deliberate.
const TABLES: { table: string; label: string }[] = [
  { table: 'products', label: 'Производи' },
  { table: 'recipes', label: 'Рецепти' },
  { table: 'recipe_ingredients', label: 'Состојки' },
  { table: 'purchases', label: 'Испораки' },
  { table: 'sales', label: 'Продажби' },
  { table: 'waste_log', label: 'Отпад' },
  { table: 'stocktake_log', label: 'Попис' },
  { table: 'events', label: 'Настани' },
  { table: 'event_menu_items', label: 'Ставки на настани' },
  { table: 'pos_imports', label: 'POS увози' },
  { table: 'pos_sales_items', label: 'POS ставки' },
  { table: 'pos_mappings', label: 'POS поврзувања' },
];

/** Row count per table. `head: true` fetches counts only, never the rows. */
export async function getTableCounts(): Promise<TableCount[]> {
  const sb = getSupabase();
  return Promise.all(
    TABLES.map(async ({ table, label }) => {
      const { count, error } = await sb.from(table).select('*', { count: 'exact', head: true });
      return { table, label, count: error ? null : (count ?? 0) };
    }),
  );
}

/**
 * Is the scanner reachable? Sends an empty body on purpose: the function
 * rejects it before calling Anthropic, so this proves the function is deployed
 * without spending anything. Any reply at all means it's alive.
 */
export async function probeScanner(): Promise<boolean> {
  try {
    const { data, error } = await getSupabase().functions.invoke('scan-invoice', { body: {} });
    if (error) return false;
    // A missing API key also comes back as a handled 200 + { error }, so treat
    // that as unavailable — otherwise Settings shows green for a scanner that
    // fails on the first real invoice.
    const message = (data as { error?: string } | null)?.error ?? '';
    return !/ANTHROPIC_API_KEY/i.test(message);
  } catch {
    return false;
  }
}
