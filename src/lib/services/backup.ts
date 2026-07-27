// Download every table as CSV, so there's a copy of the data outside Supabase.
// One file per table: the tables have different columns, and a merged file
// wouldn't open usefully in Excel.
import { getSupabase } from '@/lib/supabase';

// Supabase caps a single request at 1000 rows. Anything bigger must be paged,
// or the backup silently holds only the first page — worse than no backup.
const PAGE = 1000;

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

async function fetchAll(table: string): Promise<Row[]> {
  const sb = getSupabase();
  const rows: Row[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await sb.from(table).select('*').range(from, from + PAGE - 1);
    if (error) throw error;
    rows.push(...((data ?? []) as Row[]));
    if (!data || data.length < PAGE) return rows;
  }
}

function escape(value: unknown): string {
  if (value === null || value === undefined) return '';
  const s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(rows: Row[]): string {
  if (rows.length === 0) return '';
  const columns = Object.keys(rows[0]);
  const header = columns.join(',');
  const body = rows.map((row) => columns.map((c) => escape(row[c])).join(','));
  return [header, ...body].join('\r\n');
}

function downloadCsv(filename: string, csv: string): void {
  // The BOM makes Excel read this as UTF-8; without it Cyrillic becomes mojibake.
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // Revoking immediately can cancel the download in some browsers.
  setTimeout(() => URL.revokeObjectURL(url), 10_000);
}

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
  const stamp = new Date().toISOString().slice(0, 10);
  const saved: { table: string; rows: number }[] = [];
  const empty: string[] = [];

  for (const [i, table] of BACKUP_TABLES.entries()) {
    onProgress?.({ done: i, total: BACKUP_TABLES.length, table });
    const rows = await fetchAll(table);
    if (rows.length === 0) {
      empty.push(table);
      continue;
    }
    downloadCsv(`lira-${table}-${stamp}.csv`, toCsv(rows));
    saved.push({ table, rows: rows.length });
    // A short gap keeps browsers from dropping rapid-fire downloads.
    await new Promise((r) => setTimeout(r, 300));
  }

  onProgress?.({ done: BACKUP_TABLES.length, total: BACKUP_TABLES.length, table: '' });
  return { saved, empty };
}
