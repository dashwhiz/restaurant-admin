// Small formatting + domain helpers shared across features. Pure functions,
// no dependencies. Keep display logic here rather than inline in components.

/** Format a number as Macedonian denari, e.g. 1234 → "1.234 ден". */
export function fmtMKD(n: number | null | undefined): string {
  const v = Number(n) || 0;
  try {
    return new Intl.NumberFormat('mk-MK', {
      style: 'currency',
      currency: 'MKD',
      maximumFractionDigits: 0,
    }).format(v);
  } catch {
    return `${Math.round(v)} ден`;
  }
}

/** Format an ISO timestamp as a short local date+time. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('mk-MK', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Format an ISO date (YYYY-MM-DD) as a readable local date. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  return new Date(iso + (iso.length === 10 ? 'T00:00:00' : '')).toLocaleDateString(
    'mk-MK',
    { weekday: 'short', day: '2-digit', month: '2-digit', year: 'numeric' },
  );
}

/** Which department a category belongs to (drinks → Бар, else Кујна). */
export function departmentOf(category: string | null | undefined): 'Бар' | 'Кујна' {
  const c = (category || '').toLowerCase();
  return /пиј|бар|drink|алко|вино|пиво|раки|сок|вода|коктел/.test(c) ? 'Бар' : 'Кујна';
}

/** Normalize a value into a safe finite number. */
export function num(v: unknown, fallback = 0): number {
  const n = typeof v === 'string' ? parseFloat(v) : Number(v);
  return Number.isFinite(n) ? n : fallback;
}
