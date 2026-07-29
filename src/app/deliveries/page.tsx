'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { IconPlus, IconEdit, IconTrash, IconSearch, IconChevron } from '@/components/ui/Icons';
import { fmtMKD, fmtDate, fmtTime } from '@/lib/format';
import { exportCsv } from '@/lib/csv';
import Link from 'next/link';
import { IconScan } from '@/components/ui/Icons';
import { listProducts } from '@/lib/services/products';
import { listDeliveries, deleteDelivery, type DeliveryRow } from '@/lib/services/deliveries';
import type { Product } from '@/lib/types';
import { DeliveryDialog } from './components/DeliveryDialog';

interface DayGroup {
  day: string;
  rows: DeliveryRow[];
  total: number;
}

export default function DeliveriesPage() {
  const toast = useToast();
  const [rows, setRows] = useState<DeliveryRow[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [supplier, setSupplier] = useState('all');
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ open: boolean; row: DeliveryRow | null }>({ open: false, row: null });

  async function load() {
    setLoading(true);
    try {
      const [d, p] = await Promise.all([listDeliveries(), listProducts()]);
      setRows(d);
      setProducts(p);
      if (d.length) setOpenDays(new Set([(d[0].created_at || '').slice(0, 10)])); // newest day open
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

  const suppliers = useMemo(
    () => [...new Set(rows.map((r) => r.supplier).filter((s): s is string => !!s))].sort(),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return rows.filter((r) => {
      if (q && !(r.product?.name ?? '').toLowerCase().includes(q) && !(r.supplier ?? '').toLowerCase().includes(q)) return false;
      if (supplier !== 'all' && r.supplier !== supplier) return false;
      return true;
    });
  }, [rows, query, supplier]);

  // Group by day (newest first) — rows already arrive newest-first from
  // listDeliveries, so grouping preserves that order within and across days.
  const groups = useMemo<DayGroup[]>(() => {
    const byDay = new Map<string, DayGroup>();
    for (const r of filtered) {
      const day = (r.created_at || '').slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { day, rows: [], total: 0 });
      const g = byDay.get(day)!;
      g.rows.push(r);
      g.total += (r.quantity || 0) * (r.cost_per_unit ?? 0);
    }
    return [...byDay.values()];
  }, [filtered]);

  function toggle(day: string) {
    setOpenDays((prev) => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  }

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

  function exportRows() {
    const n = exportCsv(
      'isporaki',
      filtered.map((r) => ({
        датум: (r.created_at || '').slice(0, 10),
        производ: r.product?.name ?? '',
        количина: r.quantity ?? 0,
        цена_без_ддв: r.cost_per_unit ?? 0,
        ддв: r.ddv_rate ?? 0,
        цена_со_ддв: r.price_with_ddv ?? 0,
        вкупно: (r.quantity || 0) * (r.cost_per_unit ?? 0),
        добавувач: r.supplier ?? '',
        белешка: r.notes ?? '',
      })),
    );
    toast(n > 0 ? `Преземени ${n} испораки` : 'Нема што да се преземе', n > 0 ? 'success' : 'error');
  }

  return (
    <>
      <PageHeader
        title="Испораки"
        subtitle="Примени стоки — автоматски се додаваат во залиха"
        actions={
          <>
          <Link className="btn-ghost" href="/scan">
            <IconScan className="h-4 w-4" /> Скенирај фактура
          </Link>
          <button className="btn-ghost" onClick={exportRows} disabled={filtered.length === 0}>
            CSV
          </button>
          <button className="btn-primary" onClick={() => setDialog({ open: true, row: null })}>
            <IconPlus className="h-4 w-4" /> Нова испорака
          </button>
          </>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3">
          <IconSearch className="h-4 w-4 text-muted" />
          <input
            className="w-full bg-transparent py-2 text-sm outline-none"
            placeholder="Пребарувај по производ или добавувач…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="select w-auto"
          aria-label="Добавувач"
          value={supplier}
          onChange={(e) => setSupplier(e.target.value)}
        >
          <option value="all">Сите добавувачи</option>
          {suppliers.map((s) => (
            <option key={s} value={s}>{s}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <p className="text-sm text-muted">Вчитување…</p>
      ) : groups.length === 0 ? (
        <div className="card">
          <EmptyState text={query || supplier !== 'all' ? 'Нема резултати' : 'Сè уште нема испораки'} />
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => {
            const open = openDays.has(g.day);
            return (
              <div key={g.day} className="overflow-hidden rounded-xl border border-border">
                <button
                  onClick={() => toggle(g.day)}
                  className="flex w-full items-center gap-3 bg-surface px-4 py-3 text-left"
                >
                  <IconChevron className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                  <span className="flex-1 font-bold">{fmtDate(g.day)}</span>
                  <span className="text-xs text-muted">{g.rows.length} ставки</span>
                  {g.total > 0 && <span className="font-bold">{fmtMKD(g.total)}</span>}
                </button>
                {open && (
                  <div className="overflow-x-auto border-t border-border">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border text-left text-xs uppercase text-muted">
                        <tr>
                          <th className="p-3">Час</th>
                          <th className="p-3">Производ</th>
                          <th className="p-3 text-right">Количина</th>
                          <th className="p-3 text-right">Цена</th>
                          <th className="p-3">Добавувач</th>
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((r) => (
                          <tr key={r.id} className="border-b border-border/60 last:border-0">
                            <td className="p-3 whitespace-nowrap text-muted">{fmtTime(r.created_at)}</td>
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
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

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
