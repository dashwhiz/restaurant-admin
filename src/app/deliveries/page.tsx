'use client';

import { useEffect, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { IconPlus, IconEdit, IconTrash } from '@/components/ui/Icons';
import { fmtMKD, fmtDateTime } from '@/lib/format';
import { listProducts } from '@/lib/services/products';
import { listDeliveries, deleteDelivery, type DeliveryRow } from '@/lib/services/deliveries';
import type { Product } from '@/lib/types';
import { DeliveryDialog } from './components/DeliveryDialog';

export default function DeliveriesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialog, setDialog] = useState<{ open: boolean; row: DeliveryRow | null }>({ open: false, row: null });

  async function load() {
    setLoading(true);
    try {
      const [d, p] = await Promise.all([listDeliveries(), listProducts()]);
      setRows(d);
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

  async function remove(r: DeliveryRow) {
    if (!confirm('Избриши ја оваа испорака? Залихата ќе се врати.')) return;
    try {
      await deleteDelivery(r.id);
      toast('Избришано', 'success');
      load();
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    }
  }

  return (
    <>
      <PageHeader
        title="Испораки"
        subtitle="Примени стоки — автоматски се додаваат во залиха"
        actions={
          <button className="btn-primary" onClick={() => setDialog({ open: true, row: null })}>
            <IconPlus className="h-4 w-4" /> Нова испорака
          </button>
        }
      />

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-6 text-center text-sm text-muted">Вчитување…</p>
        ) : rows.length === 0 ? (
          <EmptyState text="Сè уште нема испораки" />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted">
              <tr>
                <th className="p-3">Датум</th>
                <th className="p-3">Производ</th>
                <th className="p-3 text-right">Количина</th>
                <th className="p-3 text-right">Цена</th>
                <th className="p-3">Добавувач</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-b border-border/60 last:border-0">
                  <td className="p-3 whitespace-nowrap text-muted">{fmtDateTime(r.created_at)}</td>
                  <td className="p-3 font-semibold">{r.product?.name ?? '?'}</td>
                  <td className="p-3 text-right">{r.quantity} {r.product?.unit ?? ''}</td>
                  <td className="p-3 text-right">{r.cost_per_unit > 0 ? fmtMKD(r.cost_per_unit) : '—'}</td>
                  <td className="p-3">{r.supplier ?? '—'}</td>
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
              ))}
            </tbody>
          </table>
        )}
      </div>

      <DeliveryDialog
        open={dialog.open}
        delivery={dialog.row}
        products={products}
        onClose={() => setDialog({ open: false, row: null })}
        onSaved={load}
      />
    </>
  );
}
