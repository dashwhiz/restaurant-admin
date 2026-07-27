'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { exportCsv } from '@/lib/csv';
import { loadOrderList, orderListAsText, type OrderList } from '@/lib/services/orders';

function Stat({ value, label, tone }: { value: number; label: string; tone?: string }) {
  return (
    <div className="card">
      <p className={`text-2xl font-bold ${tone ?? ''}`}>{value}</p>
      <p className="text-xs text-muted">{label}</p>
    </div>
  );
}

export default function OrdersPage() {
  const toast = useToast();
  const [list, setList] = useState<OrderList | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setList(await loadOrderList());
    } catch (e) {
      toast('Грешка при вчитување: ' + (e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    load();
  }, [load]);

  async function copy() {
    if (!list) return;
    try {
      await navigator.clipboard.writeText(orderListAsText(list));
      toast('Копирано — залепи го во порака до добавувачот', 'success');
    } catch {
      toast('Копирањето не успеа', 'error');
    }
  }

  function exportRows() {
    if (!list) return;
    const n = exportCsv(
      'nara4ka',
      list.items.map((i) => ({
        добавувач: i.supplier,
        производ: i.name,
        оддел: i.department_label,
        залиха: i.current_stock,
        минимум: i.min_stock,
        нарачај: i.suggested,
        единица: i.unit,
      })),
    );
    toast(n > 0 ? `Преземени ${n} ставки` : 'Нема што да се преземе', n > 0 ? 'success' : 'error');
  }

  return (
    <>
      <PageHeader
        title="Листа за нарачка"
        subtitle="Производи на или под минималната залиха"
        actions={
          <>
            <button className="btn-ghost" onClick={load} disabled={loading}>
              {loading ? 'Освежува…' : 'Освежи'}
            </button>
            <button className="btn-ghost" onClick={exportRows} disabled={!list?.items.length}>
              CSV
            </button>
            <button className="btn-primary" onClick={copy} disabled={!list?.items.length}>
              Копирај
            </button>
          </>
        }
      />

      {loading && !list ? (
        <p className="text-sm text-muted">Вчитување…</p>
      ) : !list || list.items.length === 0 ? (
        <div className="card">
          <EmptyState text="Сите производи се над минималната залиха. Нема потреба од нарачка." />
        </div>
      ) : (
        <div className="grid gap-4">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <Stat value={list.items.length} label="за нарачка" tone="text-danger" />
            <Stat value={list.supplierCount} label="добавувачи" />
            <Stat value={list.barCount} label="Бар" />
            <Stat value={list.kitchenCount} label="Кујна" />
          </div>

          {list.bySupplier.map(({ supplier, items }) => (
            <div key={supplier} className="card">
              <h2 className="mb-3 flex items-center gap-2 text-sm font-bold uppercase tracking-wide text-muted">
                {supplier}
                <Badge tone="gray">{items.length}</Badge>
              </h2>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="py-1.5 font-semibold">Производ</th>
                      <th className="py-1.5 font-semibold">Оддел</th>
                      <th className="py-1.5 text-right font-semibold">Залиха</th>
                      <th className="py-1.5 text-right font-semibold">Минимум</th>
                      <th className="py-1.5 text-right font-semibold">Нарачај</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((i) => (
                      <tr key={i.id} className="border-b border-border last:border-0">
                        <td className="py-1.5 pr-2">{i.name}</td>
                        <td className="py-1.5 pr-2 text-muted">{i.department_label}</td>
                        <td
                          className={`py-1.5 text-right whitespace-nowrap ${
                            i.current_stock <= 0 ? 'text-danger' : ''
                          }`}
                        >
                          {i.current_stock} {i.unit}
                        </td>
                        <td className="py-1.5 text-right whitespace-nowrap text-muted">
                          {i.min_stock} {i.unit}
                        </td>
                        <td className="py-1.5 text-right font-bold whitespace-nowrap">
                          {i.suggested} {i.unit}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
