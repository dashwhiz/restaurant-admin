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

// Dates are built by hand rather than via toLocaleDateString: the 'mk-MK'
// locale isn't installed on every machine and silently falls back to en-US,
// so the same screen showed "Sat, 07/04/2026" on one computer and a different
// order on another. dd/mm/yyyy everywhere, on every browser.
const pad = (n: number) => String(n).padStart(2, '0');

function toLocalDate(iso: string): Date {
  // A bare YYYY-MM-DD parses as UTC midnight, which lands on the previous day
  // west of Greenwich — pin it to local midnight instead.
  return new Date(iso + (iso.length === 10 ? 'T00:00:00' : ''));
}

/** Format an ISO date as dd/mm/yyyy. */
export function fmtDate(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = toLocalDate(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** Format an ISO timestamp as dd/mm/yyyy HH:mm. */
export function fmtDateTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = toLocalDate(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${fmtDate(iso)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

/** Time only, as HH:mm. */
export function fmtTime(iso: string | null | undefined): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return `${pad(d.getHours())}:${pad(d.getMinutes())}`;
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
