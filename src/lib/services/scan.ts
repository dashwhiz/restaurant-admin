// Invoice scanning. The Anthropic key must NEVER reach the browser, so the image
// is sent to a Supabase Edge Function ("scan-invoice") that holds the key and
// proxies Claude Vision. See docs/features/invoice-scan.md and
// supabase/functions/scan-invoice. Importing matched lines adds stock + logs a
// purchase, reversibly, through the shared stock helper.
import { getSupabase } from '@/lib/supabase';
import { applyStockDelta } from './stock';
import { lastCountDay } from './deliveries';
import { normName } from '@/lib/pos/match';

// What the Edge Function returns (one row per invoice line).
export interface ScanItem {
  name: string;
  quantity: number | null;
  unit: string | null;
  price_without_ddv: number | null;
  ddv_rate: number | null;
  price_with_ddv: number | null;
}
export interface ScanResult {
  supplier: string | null;
  invoice_number: string | null;
  invoice_date: string | null;
  doc_type: string;
  items: ScanItem[];
}

export async function scanInvoice(file: File): Promise<ScanResult> {
  const base64 = await fileToBase64(file);
  const { data, error } = await getSupabase().functions.invoke('scan-invoice', {
    body: { base64, mimeType: file.type || 'image/jpeg' },
  });
  if (error) throw error;
  if (data?.error) throw new Error(data.error); // handled errors come back 200 with { error }
  return data as ScanResult;
}

// ── Pasted JSON (no API call) ─────────────────────────────────
// Alternative to scanInvoice: upload the invoice to Claude yourself with
// SCAN_PROMPT, then paste its JSON reply. Same ScanResult, same review flow.
// Keep the prompt in sync with supabase/functions/scan-invoice/index.ts.
export const SCAN_PROMPT = `You are analyzing a Macedonian restaurant supply invoice, fiscal receipt, or delivery note (фактура / фискална сметка / испратница). The text is usually in Macedonian Cyrillic.
Read it carefully and extract EVERY product line. Return ONLY valid JSON — no explanation, no markdown, no reasoning text before or after.

Return exactly this structure:
{
  "supplier": "supplier name, or null",
  "invoice_number": "invoice number or null",
  "invoice_date": "YYYY-MM-DD or null",
  "doc_type": "invoice | fiscal | note",
  "items": [
    { "name": "product name EXACTLY as printed (keep Macedonian Cyrillic; do NOT translate)",
      "quantity": 5, "unit": "kg", "price_without_ddv": 100.00, "ddv_rate": 18, "price_with_ddv": 118.00 }
  ]
}

Rules:
- Keep product names in their original language/script. Do NOT translate.
- Extract EVERY product line, even if some prices are missing.
- Units must be one of: L, ml, kg, g, bottle, can, piece, portion, pack, bag, box. Map КГ→kg, Л→L, КОМ/ПАРЧ→piece, ПОР→portion. If a case/carton/pack shows a piece count, convert to pieces AND divide its price by that count, so the price stays per single piece (1 pack of 20 tea bags at 76.00 → quantity 20, price_with_ddv 3.80 — never 20 at 76.00).
- ddv_rate is a number only (5, 10 or 18), not "18%".
- Prices are PER SINGLE UNIT, not line totals. A fiscal receipt's prices INCLUDE VAT (fill price_with_ddv, leave price_without_ddv null); an invoice usually lists price without VAT. Use null for any price you cannot read.
- doc_type: "fiscal" for a фискална сметка, "note" for испратница, otherwise "invoice".`;

const numOrNull = (v: unknown): number | null => {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
};
const strOrNull = (v: unknown): string | null =>
  typeof v === 'string' && v.trim() ? v.trim() : null;

/** Parse JSON pasted from a Claude chat into a ScanResult. Tolerates ```json
 *  fences and text around the object; throws a Macedonian message otherwise. */
export function parseScanJson(text: string): ScanResult {
  let clean = text.replace(/```json|```/g, '').trim();
  const first = clean.indexOf('{');
  const last = clean.lastIndexOf('}');
  if (first >= 0 && last > first) clean = clean.slice(first, last + 1);

  let raw: Record<string, unknown>;
  try {
    raw = JSON.parse(clean);
  } catch {
    throw new Error('Ова не е валиден JSON.');
  }
  if (!raw || !Array.isArray(raw.items)) throw new Error('JSON-от нема листа "items".');

  return {
    supplier: strOrNull(raw.supplier),
    invoice_number: strOrNull(raw.invoice_number),
    invoice_date: strOrNull(raw.invoice_date),
    doc_type: strOrNull(raw.doc_type) ?? 'invoice',
    items: (raw.items as Record<string, unknown>[])
      .filter((it) => it && strOrNull(it.name))
      .map((it) => ({
        name: strOrNull(it.name)!,
        quantity: numOrNull(it.quantity),
        unit: strOrNull(it.unit),
        price_without_ddv: numOrNull(it.price_without_ddv),
        ddv_rate: numOrNull(it.ddv_rate),
        price_with_ddv: numOrNull(it.price_with_ddv),
      })),
  };
}

// ── Remembered invoice lines ──────────────────────────────────
// Suppliers word the same product differently ("Шеќер бел 1кг" vs "Секер 1/1"),
// so once you've told us which product a line means, remember it per supplier.
// Same idea as pos_mappings, different domain: purchased products, not recipes.
//
// Optional table (a one-time SQL step, like pos_mappings was). Once we learn
// it's absent we stop asking, so a missing table costs one failed request, not
// one per scan.
const TABLE_MISSING = /does not exist|find the table|relation|schema cache/i;
let scanMappingsMissing = false;

const supplierKey = (s: string | null | undefined) => (s ?? '').trim().toLowerCase();

/** Map key for a supplier + invoice line. Names are normalised, so spacing and
 *  case differences between invoices still hit the same remembered answer. */
export function scanMapKey(supplier: string | null, lineName: string): string {
  return `${supplierKey(supplier)}|${normName(lineName)}`;
}

export async function getScanMappings(): Promise<Map<string, string>> {
  const remembered = new Map<string, string>();
  if (scanMappingsMissing) return remembered;

  const { data, error } = await getSupabase()
    .from('scan_mappings')
    .select('supplier, line_key, product_id');
  if (error) {
    if (TABLE_MISSING.test(error.message)) {
      scanMappingsMissing = true;
      return remembered;
    }
    throw error;
  }
  for (const row of (data ?? []) as { supplier: string | null; line_key: string; product_id: string | null }[]) {
    if (row.product_id) remembered.set(`${supplierKey(row.supplier)}|${row.line_key}`, row.product_id);
  }
  return remembered;
}

/** Remember which product each invoice line meant. One batched upsert. */
export async function saveScanMappings(
  supplier: string | null,
  entries: { name: string; productId: string }[],
): Promise<void> {
  if (scanMappingsMissing || entries.length === 0) return;

  // Postgres rejects an upsert that touches the same key twice, and one invoice
  // can easily list the same product on two lines — keep the last of each.
  const byKey = new Map<string, { supplier: string; line_key: string; product_id: string }>();
  for (const e of entries) {
    const line_key = normName(e.name);
    if (!line_key) continue;
    byKey.set(line_key, { supplier: (supplier ?? '').trim(), line_key, product_id: e.productId });
  }
  if (byKey.size === 0) return;

  const { error } = await getSupabase()
    .from('scan_mappings')
    .upsert([...byKey.values()], { onConflict: 'supplier,line_key' });
  if (error) {
    if (TABLE_MISSING.test(error.message)) scanMappingsMissing = true;
    else throw error;
  }
}

// A reviewed line ready to import. `target` is a product id, or a sentinel.
export const NEW_PRODUCT = '__new__';
export const SKIP = '__skip__';

export interface ImportLine {
  name: string;
  quantity: number;
  unit: string;
  cost_per_unit: number; // без ДДВ — this is the stored product cost
  ddv_rate: number;
  /** false = the invoice showed no rate; then the product's rate is left alone. */
  ddv_read: boolean;
  price_with_ddv: number;
  target: string;
}

// Thrown when a line fails mid-batch. `processed` = how many input lines were
// already handled (imported or skipped) before the failure. The page uses it to
// drop those rows so a retry can't re-import — and re-inflate stock — for them.
export class ScanImportError extends Error {
  constructor(message: string, readonly processed: number) {
    super(message);
    this.name = 'ScanImportError';
  }
}

/** The note every scanned delivery line carries; also how a re-import is spotted. */
function invoiceNote(invoiceNumber: string | null): string {
  return invoiceNumber ? `Фактура ${invoiceNumber} · Скенирање` : 'Скенирање';
}

export interface ImportedInvoice {
  supplier: string | null;
  date: string;
  lines: number;
}

/** Supplier name without legal form, town and punctuation: "ГРАНДПРОМ-ЗУР Д.О.О.Е.Л." = "ГРАНДПРОМ-ЗУР ДООЕЛ". */
const LEGAL_WORDS = new Set(['дооел', 'доел', 'доо', 'ад', 'скопје', 'dooel', 'doo', 'skopje']);
function supplierCore(s: string | null): string {
  return normName(s ?? '')
    .split(' ')
    .filter((w) => w && !LEGAL_WORDS.has(w))
    .join('');
}

/**
 * An invoice already imported: same invoice number AND same supplier (owner's
 * rule). Short numbers (0077) repeat across suppliers, so the number alone
 * isn't enough. The supplier is compared without legal form and punctuation,
 * because the scan reads "ДООЕЛ" / "Д.О.О.Е.Л." differently each time (0474
 * went in twice that way). Without a number there's nothing to compare.
 */
export async function findImportedInvoice(meta: {
  supplier: string | null;
  invoiceNumber: string | null;
}): Promise<ImportedInvoice | null> {
  if (!meta.invoiceNumber?.trim()) return null;
  const { data, error } = await getSupabase()
    .from('purchases')
    .select('supplier, created_at')
    .eq('notes', invoiceNote(meta.invoiceNumber));
  if (error) throw error;
  const key = supplierCore(meta.supplier);
  const hits = (data ?? []).filter((r) => supplierCore(r.supplier as string | null) === key);
  if (hits.length === 0) return null;
  return { supplier: hits[0].supplier as string | null, date: (hits[0].created_at as string).slice(0, 10), lines: hits.length };
}

export async function importScannedInvoice(
  lines: ImportLine[],
  meta: { supplier: string | null; invoiceNumber: string | null; invoiceDate: string | null },
  /** Finishing an import that failed part-way: its first lines are already in. */
  resume = false,
): Promise<{ imported: number; created: number; beforeCount: number }> {
  if (!resume && (await findImportedInvoice(meta))) {
    throw new Error(`Фактура ${meta.invoiceNumber} е веќе внесена и не може да се внесе повторно`);
  }
  const sb = getSupabase();
  const note = invoiceNote(meta.invoiceNumber);
  // Date the delivery when it actually arrived, not when it was scanned — a
  // stack of invoices entered on one evening would otherwise all land today and
  // skew every date-based figure. Midday avoids sliding a day across timezones.
  const receivedAt = /^\d{4}-\d{2}-\d{2}$/.test(meta.invoiceDate ?? '')
    ? `${meta.invoiceDate}T12:00:00Z`
    : null;
  let imported = 0;
  let created = 0;
  let beforeCount = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.target === SKIP || !line.quantity || line.quantity <= 0) continue;

    try {
      let productId = line.target;
      if (line.target === NEW_PRODUCT) {
        const { data, error } = await sb
          .from('products')
          .insert({
            name: line.name, category: 'Суровина', unit: line.unit, department: 'Кујна',
            current_stock: 0, min_stock: 0, cost_per_unit: line.cost_per_unit,
            ddv_rate: line.ddv_read ? line.ddv_rate : null,
          })
          .select('id')
          .single();
        if (error) throw error;
        productId = data.id as string;
        created++;
      } else {
        // The latest invoice sets the product's cost, and its VAT rate when
        // the invoice actually showed one.
        const patch = {
          ...(line.cost_per_unit > 0 ? { cost_per_unit: line.cost_per_unit } : {}),
          ...(line.ddv_read && line.ddv_rate > 0 ? { ddv_rate: line.ddv_rate } : {}),
        };
        if (Object.keys(patch).length > 0) {
          const { error } = await sb.from('products').update(patch).eq('id', productId);
          if (error) throw error;
        }
      }

      // An invoice dated before the product's last count is already in that
      // count (Лозова Жолта: 24 L scanned after the 17.10 count went on top).
      const countDay = receivedAt ? await lastCountDay(productId) : null;
      const applyStock = !(countDay && meta.invoiceDate! < countDay);

      const { error: pErr } = await sb.from('purchases').insert({
        product_id: productId,
        quantity: line.quantity,
        cost_per_unit: line.cost_per_unit,
        ddv_rate: line.ddv_rate,
        price_with_ddv: line.price_with_ddv,
        supplier: meta.supplier,
        notes: note,
        // Omitted when the invoice had no readable date — the DB default (now)
        // is the honest fallback rather than a guess.
        ...(receivedAt ? { created_at: receivedAt } : {}),
        stock_applied: applyStock,
      });
      if (pErr) throw pErr;

      if (applyStock) await applyStockDelta(productId, line.quantity);
      else beforeCount++;
      imported++;
    } catch (e) {
      throw new ScanImportError((e as Error).message, i);
    }
  }
  return { imported, created, beforeCount };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
