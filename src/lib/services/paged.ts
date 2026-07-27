// Supabase returns at most 1000 rows per request. Anything that has to be
// COMPLETE — backups, analytics totals — must page, or it silently returns the
// first 1000 rows and the numbers are quietly wrong.
import { getSupabase } from '@/lib/supabase';

const PAGE = 1000;

export interface PagedOptions {
  /** Columns to select, including embedded joins. Defaults to '*'. */
  select?: string;
  /** Optional lower bound, e.g. only rows since a date. */
  gte?: { column: string; value: string };
}

export async function fetchAllRows<T>(table: string, opts: PagedOptions = {}): Promise<T[]> {
  const sb = getSupabase();
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE) {
    let query = sb.from(table).select(opts.select ?? '*').range(from, from + PAGE - 1);
    if (opts.gte) query = query.gte(opts.gte.column, opts.gte.value);
    const { data, error } = await query;
    if (error) throw error;
    rows.push(...((data ?? []) as T[]));
    if (!data || data.length < PAGE) return rows;
  }
}
