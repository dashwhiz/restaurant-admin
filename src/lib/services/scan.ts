// Invoice scanning. The Anthropic key must NEVER reach the browser, so the image
// is sent to a Supabase Edge Function ("scan-invoice") that holds the key and
// proxies Claude Vision. See docs/features/invoice-scan.md and
// supabase/functions/scan-invoice. Importing matched lines adds stock + logs a
// purchase, reversibly, through the shared stock helper.
import { getSupabase } from '@/lib/supabase';
import { applyStockDelta } from './stock';

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
  meta: { supplier: string | null; invoiceNumber: string | null },
): Promise<{ imported: number; created: number }> {
  const sb = getSupabase();
  const note = meta.invoiceNumber ? `Фактура ${meta.invoiceNumber} · Скенирање` : 'Скенирање';
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
