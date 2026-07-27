// CSV generation, shared by the whole-database backup and the per-page exports.
// One implementation so the Excel-specific details (BOM, CRLF, formula guard)
// can't drift apart between them.

export type CsvValue = string | number | boolean | null | undefined;

function escape(value: unknown): string {
  if (value === null || value === undefined) return '';
  let s = typeof value === 'object' ? JSON.stringify(value) : String(value);
  // Excel executes a cell starting with = + - @ as a formula. POS-decoded names
  // are not sanitised, so prefix an apostrophe to keep them as plain text — but
  // never for a real number, or negative stock (allowed here) would import as
  // text and stop adding up.
  if (/^[=+\-@]/.test(s) && !Number.isFinite(Number(s))) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/** Rows of objects → CSV text. Columns come from the first row's keys. */
export function toCsv(rows: Record<string, unknown>[]): string {
  if (rows.length === 0) return '';
  const columns = Object.keys(rows[0]);
  const body = rows.map((row) => columns.map((c) => escape(row[c])).join(','));
  // CRLF is what Excel on Windows expects.
  return [columns.join(','), ...body].join('\r\n');
}

/** Trigger a download of `csv` as `filename`. */
export function downloadCsv(filename: string, csv: string): void {
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

/** Today as YYYY-MM-DD, for filenames. */
export function stamp(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Build and download in one call. Returns how many rows were written. */
export function exportCsv(name: string, rows: Record<string, unknown>[]): number {
  if (rows.length === 0) return 0;
  downloadCsv(`lira-${name}-${stamp()}.csv`, toCsv(rows));
  return rows.length;
}
