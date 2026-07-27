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
  /** Restrict to a set of values, e.g. only items of these imports. */
  in?: { column: string; values: string[] };
  /** SQL LIKE pattern, e.g. notes starting with "POS ". */
  like?: { column: string; pattern: string };
}

export async function fetchAllRows<T>(table: string, opts: PagedOptions = {}): Promise<T[]> {
  const sb = getSupabase();
  const rows: T[] = [];
  for (let from = 0; ; ) {
    // Order matters: without a stable sort Postgres gives no ordering guarantee
    // across LIMIT/OFFSET pages, so a concurrent write can make a row show up
    // twice or not at all.
    let query = sb
      .from(table)
      .select(opts.select ?? '*')
      .order('id', { ascending: true })
      .range(from, from + PAGE - 1);
    if (opts.gte) query = query.gte(opts.gte.column, opts.gte.value);
    if (opts.in) query = query.in(opts.in.column, opts.in.values);
    if (opts.like) query = query.like(opts.like.column, opts.like.pattern);
    const { data, error } = await query;
    if (error) throw error;
    const batch = (data ?? []) as T[];
    rows.push(...batch);
    // Advance by what actually came back rather than assuming the server's page
    // size is ours — a smaller db-max-rows would otherwise stop us after one page.
    if (batch.length === 0) return rows;
    from += batch.length;
  }
}
