// Download every table as CSV, so there's a copy of the data outside Supabase.
// One file per table: the tables have different columns, and a merged file
// wouldn't open usefully in Excel.
import { fetchAllRows } from './paged';
import { toCsv, downloadCsv, stamp } from '@/lib/csv';

export const BACKUP_TABLES = [
  'products',
  'recipes',
  'recipe_ingredients',
  'purchases',
  'sales',
  'waste_log',
  'stocktake_log',
  'events',
  'event_menu_items',
  'pos_imports',
  'pos_sales_items',
  'pos_mappings',
] as const;

type Row = Record<string, unknown>;

export interface BackupProgress {
  done: number;
  total: number;
  table: string;
}

export interface BackupResult {
  /** Tables that produced a file, with how many rows each held. */
  saved: { table: string; rows: number }[];
  /** Tables skipped because they hold no rows — nothing to save. */
  empty: string[];
}

/**
 * Download one CSV per table. Files arrive one after another; browsers ask once
 * to allow multiple downloads.
 */
export async function exportAllTables(
  onProgress?: (p: BackupProgress) => void,
): Promise<BackupResult> {
  const day = stamp();
  const saved: { table: string; rows: number }[] = [];
  const empty: string[] = [];

  for (const [i, table] of BACKUP_TABLES.entries()) {
    onProgress?.({ done: i, total: BACKUP_TABLES.length, table });
    const rows = await fetchAllRows<Row>(table);
    if (rows.length === 0) {
      empty.push(table);
      continue;
    }
    downloadCsv(`lira-${table}-${day}.csv`, toCsv(rows));
    saved.push({ table, rows: rows.length });
    // A short gap keeps browsers from dropping rapid-fire downloads.
    await new Promise((r) => setTimeout(r, 300));
  }

  onProgress?.({ done: BACKUP_TABLES.length, total: BACKUP_TABLES.length, table: '' });
  return { saved, empty };
}
