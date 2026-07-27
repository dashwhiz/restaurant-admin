'use client';

import { useEffect, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { IconPlus, IconEdit, IconTrash } from '@/components/ui/Icons';
import { fmtMKD, fmtDateTime } from '@/lib/format';
import { listProducts } from '@/lib/services/products';
import { listWaste, deleteWaste, type WasteRow } from '@/lib/services/waste';
import type { Product } from '@/lib/types';
import { WasteDialog } from './components/WasteDialog';

export default function WastePage() {
  const toast = useToast();
  const [rows, setRows] = useState<WasteRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; row: WasteRow | null }>({ open: false, row: null });

  async function load() {
    setLoading(true);
    try {
      const [w, p] = await Promise.all([listWaste(), listProducts()]);
      setRows(w);
      setProducts(p);
    } catch (e) {
      toast('Грешка при вчитување: ' + (e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function remove(r: WasteRow) {
    if (!confirm('Избриши го овој запис? Залихата ќе се врати.')) return;
    try {
      await deleteWaste(r.id);
      toast('Избришано', 'success');
      load();
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    }
  }

  return (
    <>
      <PageHeader
        title="Отпад и расип"
        subtitle="Загуби — автоматски се одземаат од залиха"
        actions={
          <button className="btn-primary" onClick={() => setDialog({ open: true, row: null })}>
            <IconPlus className="h-4 w-4" /> Нов запис
          </button>
        }
      />

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-6 text-center text-sm text-muted">Вчитување…</p>
        ) : rows.length === 0 ? (
          <EmptyState text="Сè уште нема внесен отпад" />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted">
              <tr>
                <th className="p-3">Датум</th>
                <th className="p-3">Производ</th>
                <th className="p-3 text-right">Количина</th>
                <th className="p-3">Причина</th>
                <th className="p-3 text-right">Вредност</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                const val = r.quantity * (r.product?.cost_per_unit ?? 0);
                return (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="p-3 whitespace-nowrap text-muted">{fmtDateTime(r.created_at)}</td>
                    <td className="p-3 font-semibold">{r.product?.name ?? '?'}</td>
                    <td className="p-3 text-right text-danger">−{r.quantity} {r.product?.unit ?? ''}</td>
                    <td className="p-3"><Badge tone="yellow">{r.reason}</Badge></td>
                    <td className="p-3 text-right">{val > 0 ? fmtMKD(val) : '—'}</td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost px-2 py-1" onClick={() => setDialog({ open: true, row: r })} aria-label="Измени">
                          <IconEdit className="h-4 w-4" />
                        </button>
                        <button className="btn-ghost px-2 py-1 text-danger" onClick={() => remove(r)} aria-label="Избриши">
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <WasteDialog
        open={dialog.open}
        waste={dialog.row}
        products={products}
        onClose={() => setDialog({ open: false, row: null })}
        onSaved={load}
      />
    </>
  );
}
