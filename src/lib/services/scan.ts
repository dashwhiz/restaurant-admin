// Invoice scanning. The Anthropic key must NEVER reach the browser, so the image
// is sent to a Supabase Edge Function ("scan-invoice") that holds the key and
// proxies Claude Vision. See docs/features/invoice-scan.md and
// supabase/functions/scan-invoice. Importing matched lines adds stock + logs a
// purchase, reversibly, through the shared stock helper.
import { getSupabase } from '@/lib/supabase';
import { applyStockDelta } from './stock';
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

export async function importScannedInvoice(
  lines: ImportLine[],
  meta: { supplier: string | null; invoiceNumber: string | null; invoiceDate: string | null },
): Promise<{ imported: number; created: number }> {
  const sb = getSupabase();
  const note = meta.invoiceNumber ? `Фактура ${meta.invoiceNumber} · Скенирање` : 'Скенирање';
  // Date the delivery when it actually arrived, not when it was scanned — a
  // stack of invoices entered on one evening would otherwise all land today and
  // skew every date-based figure. Midday avoids sliding a day across timezones.
  const receivedAt = /^\d{4}-\d{2}-\d{2}$/.test(meta.invoiceDate ?? '')
    ? `${meta.invoiceDate}T12:00:00Z`
    : null;
  let imported = 0;
  let created = 0;

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
          })
          .select('id')
          .single();
        if (error) throw error;
        productId = data.id as string;
        created++;
      } else if (line.cost_per_unit > 0) {
        const { error } = await sb.from('products').update({ cost_per_unit: line.cost_per_unit }).eq('id', productId);
        if (error) throw error;
      }

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
      });
      if (pErr) throw pErr;

      await applyStockDelta(productId, line.quantity);
      imported++;
    } catch (e) {
      throw new ScanImportError((e as Error).message, i);
    }
  }
  return { imported, created };
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve((reader.result as string).split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
