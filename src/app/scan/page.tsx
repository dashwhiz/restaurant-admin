'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { IconScan } from '@/components/ui/Icons';
import { fmtDate } from '@/lib/format';
import { listProducts } from '@/lib/services/products';
import {
  scanInvoice,
  importScannedInvoice,
  getScanMappings,
  saveScanMappings,
  scanMapKey,
  ScanImportError,
  NEW_PRODUCT,
  SKIP,
  type ScanResult,
  type ImportLine,
} from '@/lib/services/scan';
import { bestMatch } from '@/lib/pos/match';
import { ProductPicker } from './components/ProductPicker';
import type { Product } from '@/lib/types';

const UNITS = ['L', 'ml', 'kg', 'g', 'bottle', 'can', 'piece', 'portion', 'pack', 'bag', 'box'];
const DDV_RATES = ['0', '5', '10', '18'];

// One editable review row (all numbers kept as strings while editing).
interface Row {
  name: string;
  quantity: string;
  unit: string;
  priceNoDDV: string;
  ddvRate: string;
  priceDDV: string;
  target: string; // product id | NEW_PRODUCT | SKIP
  matchName: string | null;
  matchPct: number;
}

function num(v: string): number {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
}

// A scan already spent a Claude Vision call — don't lose that review if the
// tab or app closes before you confirm or cancel it. Kept in localStorage
// (not sessionStorage) so it survives closing the app entirely, not just a
// reload.
const DRAFT_KEY = 'lira-scan-draft';

interface Draft {
  result: ScanResult;
  rows: Row[];
}

function loadDraft(): Draft | null {
  try {
    const raw = localStorage.getItem(DRAFT_KEY);
    return raw ? (JSON.parse(raw) as Draft) : null;
  } catch {
    return null;
  }
}

function saveDraft(draft: Draft) {
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
  } catch {
    // storage full/unavailable — losing the recovery safety net isn't fatal
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY);
  } catch {
    // ignore
  }
}

export default function ScanPage() {
  const toast = useToast();
  const [phase, setPhase] = useState<'idle' | 'scanning' | 'review'>('idle');
  const [products, setProducts] = useState<Product[]>([]);
  const [result, setResult] = useState<ScanResult | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [busy, setBusy] = useState(false);

  // Resume an unfinished review left over from before the app closed. Loads
  // products first so the review table doesn't flash with blank match names.
  useEffect(() => {
    const draft = loadDraft();
    if (!draft) return;
    (async () => {
      const prods = await listProducts().catch(() => []);
      setProducts(prods);
      setResult(draft.result);
      setRows(draft.rows);
      setPhase('review');
    })();
  }, []);

  // Keep the draft in sync with every edit while reviewing.
  useEffect(() => {
    if (phase === 'review' && result) saveDraft({ result, rows });
  }, [phase, result, rows]);

  async function onFile(file: File) {
    setPhase('scanning');
    try {
      const [scan, prods, remembered] = await Promise.all([
        scanInvoice(file),
        listProducts(),
        getScanMappings(),
      ]);
      setProducts(prods);
      setResult(scan);
      setRows(
        scan.items.map((it) => {
          // A remembered choice beats a fuzzy guess — you already told us once.
          const rememberedId = remembered.get(scanMapKey(scan.supplier, it.name));
          const known = rememberedId ? prods.find((p) => p.id === rememberedId) : undefined;
          const m = known ? null : bestMatch(it.name, prods);
          // Со-ДДВ is derived from без-ДДВ × (1 + rate), not taken as read off
          // the invoice — an invoice usually prints без-ДДВ and the rate
          // clearly, so trust those over Claude's own со-ДДВ reading. Fiscal
          // receipts only print со-ДДВ (no base), so fall back to the read
          // value when there's no base to calculate from.
          const rate = it.ddv_rate != null ? it.ddv_rate : 18;
          const base = it.price_without_ddv;
          const priceDDV =
            base != null && base > 0
              ? (base * (1 + rate / 100)).toFixed(2)
              : it.price_with_ddv != null
                ? String(it.price_with_ddv)
                : '';
          return {
            name: it.name,
            quantity: it.quantity != null ? String(it.quantity) : '',
            unit: it.unit && UNITS.includes(it.unit) ? it.unit : 'piece',
            priceNoDDV: it.price_without_ddv != null ? String(it.price_without_ddv) : '',
            ddvRate: it.ddv_rate != null ? String(it.ddv_rate) : '18',
            priceDDV,
            target: known ? known.id : m ? m.item.id : NEW_PRODUCT,
            matchName: known ? known.name : m ? m.item.name : null,
            matchPct: known ? 100 : m ? Math.round(m.score * 100) : 0,
          };
        }),
      );
      setPhase('review');
      if (scan.items.length === 0) toast('Не се прочитани ставки од фактурата', 'error');
    } catch (e) {
      toast('Грешка при скенирање: ' + (e as Error).message, 'error');
      setPhase('idle');
    }
  }

  function patch(i: number, next: Partial<Row>) {
    setRows((rs) =>
      rs.map((r, idx) => {
        if (idx !== i) return r;
        const merged = { ...r, ...next };
        // Keep the two prices in sync. Editing base or rate fills со-ДДВ;
        // editing со-ДДВ back-fills the base (needed for fiscal receipts, which
        // only print the with-VAT price).
        if ('priceNoDDV' in next || 'ddvRate' in next) {
          const base = num(merged.priceNoDDV);
          if (base > 0) merged.priceDDV = (base * (1 + num(merged.ddvRate) / 100)).toFixed(2);
        } else if ('priceDDV' in next) {
          const withDDV = num(merged.priceDDV);
          if (withDDV > 0) merged.priceNoDDV = (withDDV / (1 + num(merged.ddvRate) / 100)).toFixed(2);
        }
        return merged;
      }),
    );
  }

  function reset() {
    setPhase('idle');
    setResult(null);
    setRows([]);
    clearDraft();
  }

  async function confirm() {
    if (!result) return;
    setBusy(true);
    try {
      const lines: ImportLine[] = rows.map((r) => {
        // Stored cost is the без-ДДВ unit price; derive it from со-ДДВ when only
        // that is known (fiscal receipts), so cost is never lost.
        let base = num(r.priceNoDDV);
        const withDDV = num(r.priceDDV);
        const rate = num(r.ddvRate);
        if (base <= 0 && withDDV > 0) base = Number((withDDV / (1 + rate / 100)).toFixed(2));
        return {
          name: r.name,
          quantity: num(r.quantity),
          unit: r.unit,
          cost_per_unit: base,
          ddv_rate: rate,
          price_with_ddv: withDDV,
          target: r.target,
        };
      });
      const { imported, created } = await importScannedInvoice(lines, {
        supplier: result.supplier,
        invoiceNumber: result.invoice_number,
        invoiceDate: result.invoice_date,
      });
      // Remember the confirmed lines so the next invoice from this supplier
      // arrives already matched. Best-effort: a failure here must not look like
      // a failed import, because the stock has already moved.
      await saveScanMappings(
        result.supplier,
        rows
          .filter((r) => r.target !== SKIP && r.target !== NEW_PRODUCT)
          .map((r) => ({ name: r.name, productId: r.target })),
      ).catch(() => {});

      toast(
        `Увезени ${imported} ставки${created ? ` · создадени ${created} нови производи` : ''}`,
        'success',
      );
      reset();
    } catch (e) {
      // On a mid-batch failure, drop the lines already imported so a retry won't
      // double-count stock — only the failed line onward stays in the table.
      if (e instanceof ScanImportError) {
        setRows((rs) => rs.slice(e.processed));
        toast(`Увезено делумно. Грешка на ставка ${e.processed + 1}: ${e.message}`, 'error');
      } else {
        toast('Грешка: ' + (e as Error).message, 'error');
      }
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Скенирај фактура"
        subtitle="Сликај или прикачи фактура/фискална сметка — Claude ги чита ставките, ти ги провери и увези"
      />

      {phase === 'idle' && (
        <div className="card flex flex-col items-center gap-3 border-dashed py-12 text-center">
          <IconScan className="h-8 w-8 text-muted" />
          <span className="font-semibold">Скенирај фактура</span>
          <span className="text-xs text-muted">
            PDF се чита подобро од слика — ако имаш PDF, користи го.
          </span>

          <div className="mt-1 flex flex-wrap justify-center gap-2">
            {/* No `capture` here: on a phone that attribute forces the camera and
                hides the file picker entirely, which is what made PDFs
                unreachable. Without it you get Photos / Files / Camera. */}
            <label className="btn-primary cursor-pointer">
              Избери фајл
              <input
                type="file"
                accept="image/*,application/pdf,.pdf"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </label>

            {/* Keeps the one-tap straight-to-camera path for a paper invoice. */}
            <label className="btn-ghost cursor-pointer">
              Сликај
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && onFile(e.target.files[0])}
              />
            </label>
          </div>
        </div>
      )}

      {phase === 'scanning' && (
        <div className="card flex flex-col items-center gap-2 py-12 text-center text-sm text-muted">
          <IconScan className="h-8 w-8 animate-pulse text-primary" />
          Се чита фактурата… ова може да потрае неколку секунди.
        </div>
      )}

      {phase === 'review' && result && (
        <div className="card">
          <div className="mb-3 flex flex-wrap items-center gap-3">
            {result.supplier && <Badge tone="blue">{result.supplier}</Badge>}
            {result.invoice_number && <span className="text-sm text-muted">Фактура {result.invoice_number}</span>}
            {result.invoice_date && <span className="text-sm text-muted">{fmtDate(result.invoice_date)}</span>}
            <span className="ml-auto text-sm text-muted">{rows.length} ставки</span>
            <button className="btn-ghost" onClick={reset}>Друга фактура</button>
          </div>

          <div className="max-h-[60vh] overflow-auto rounded-lg border border-border">
            {rows.length === 0 ? (
              <EmptyState text="Нема прочитани ставки" />
            ) : (
              <table className="w-full min-w-[720px] text-sm">
                <thead className="sticky top-0 border-b border-border bg-surface text-left text-xs uppercase text-muted">
                  <tr>
                    <th className="p-2">Ставка</th>
                    <th className="p-2 text-right">Кол.</th>
                    <th className="p-2">Ед.</th>
                    <th className="p-2 text-right">Без ДДВ</th>
                    <th className="p-2">ДДВ</th>
                    <th className="p-2 text-right">Со ДДВ</th>
                    <th className="p-2">Производ</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i} className="border-b border-border/60 last:border-0">
                      <td className="p-2">
                        <div className="font-medium">{r.name}</div>
                        {(() => {
                          const sel = products.find((p) => p.id === r.target);
                          if (sel)
                            return (
                              <Badge tone="green">
                                {sel.name}
                                {r.matchName === sel.name && r.matchPct > 0 ? ` · ${r.matchPct}%` : ''}
                              </Badge>
                            );
                          if (r.target === NEW_PRODUCT) return <Badge tone="purple">Нов производ</Badge>;
                          return <Badge tone="yellow">Прескокнато</Badge>;
                        })()}
                      </td>
                      <td className="p-2">
                        <input
                          type="number" min="0" step="0.001"
                          className="input w-20 py-1 text-right"
                          value={r.quantity}
                          onChange={(e) => patch(i, { quantity: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <select className="input w-20 py-1" value={r.unit} onChange={(e) => patch(i, { unit: e.target.value })}>
                          {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number" min="0" step="0.01"
                          className="input w-24 py-1 text-right"
                          value={r.priceNoDDV}
                          onChange={(e) => patch(i, { priceNoDDV: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <select className="input w-16 py-1" value={r.ddvRate} onChange={(e) => patch(i, { ddvRate: e.target.value })}>
                          {DDV_RATES.map((d) => <option key={d} value={d}>{d}%</option>)}
                        </select>
                      </td>
                      <td className="p-2">
                        <input
                          type="number" min="0" step="0.01"
                          className="input w-24 py-1 text-right"
                          value={r.priceDDV}
                          onChange={(e) => patch(i, { priceDDV: e.target.value })}
                        />
                      </td>
                      <td className="p-2">
                        <ProductPicker
                          value={r.target}
                          products={products}
                          onChange={(next) => patch(i, { target: next })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>

          <div className="mt-4 flex justify-end gap-2">
            <button className="btn-ghost" onClick={reset}>Откажи</button>
            <button className="btn-primary" onClick={confirm} disabled={busy || rows.length === 0}>
              {busy ? 'Увезување…' : 'Увези во залиха'}
            </button>
          </div>
        </div>
      )}
    </>
  );
}
