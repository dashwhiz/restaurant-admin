'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { IconPlus, IconEdit, IconTrash, IconSearch, IconChevron } from '@/components/ui/Icons';
import { fmtMKD, fmtDate, fmtTime } from '@/lib/format';
import { exportCsv, downloadCsv, toCsv } from '@/lib/csv';
import Link from 'next/link';
import { IconScan } from '@/components/ui/Icons';
import { listProducts } from '@/lib/services/products';
import { listDeliveries, deleteDelivery, type DeliveryRow } from '@/lib/services/deliveries';
import type { Product } from '@/lib/types';
import { DeliveryDialog } from './components/DeliveryDialog';

const NO_SUPPLIER = '—';

interface Group {
  key: string;
  label: string;
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
  const [groupBy, setGroupBy] = useState<'date' | 'supplier'>('date');
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
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

  // Two ways to organise the same rows — by day (newest first, the default) or
  // by supplier (alphabetical, no-supplier last).
  const groups = useMemo<Group[]>(() => {
    const byKey = new Map<string, Group>();
    for (const r of filtered) {
      const key = groupBy === 'supplier' ? r.supplier?.trim() || NO_SUPPLIER : (r.created_at || '').slice(0, 10);
      const label = groupBy === 'supplier' ? key : fmtDate(key);
      if (!byKey.has(key)) byKey.set(key, { key, label, rows: [], total: 0 });
      const g = byKey.get(key)!;
      g.rows.push(r);
      g.total += (r.quantity || 0) * (r.cost_per_unit ?? 0);
    }
    const list = [...byKey.values()];
    if (groupBy === 'supplier') {
      list.sort((a, b) => (a.key === NO_SUPPLIER ? 1 : b.key === NO_SUPPLIER ? -1 : a.label.localeCompare(b.label, 'mk')));
    }
    return list; // date groups stay in the newest-first order rows already arrive in
  }, [filtered, groupBy]);

  // Switching the tab needs a sensible default open state: the newest day for
  // "by date", everything open for "by supplier" (there are far fewer suppliers).
  function chooseGroupBy(next: 'date' | 'supplier') {
    setGroupBy(next);
    setOpenGroups(new Set()); // start closed, same as the initial page load
  }

  function toggle(key: string) {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
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

  function rowsFor(list: DeliveryRow[]) {
    return list.map((r) => ({
      датум: (r.created_at || '').slice(0, 10),
      производ: r.product?.name ?? '',
      количина: r.quantity ?? 0,
      цена_без_ддв: r.cost_per_unit ?? 0,
      ддв: r.ddv_rate ?? 0,
      цена_со_ддв: r.price_with_ddv ?? 0,
      вкупно: (r.quantity || 0) * (r.cost_per_unit ?? 0),
      добавувач: r.supplier ?? '',
      белешка: r.notes ?? '',
    }));
  }

  function exportRows() {
    const n = exportCsv('isporaki', rowsFor(filtered));
    toast(n > 0 ? `Преземени ${n} испораки` : 'Нема што да се преземе', n > 0 ? 'success' : 'error');
  }

  // Filenames need to survive the filesystem — spaces and punctuation in a
  // supplier name don't.
  function slug(s: string): string {
    return s.trim().toLowerCase().replace(/\s+/g, '-').replace(/[^\p{L}\p{N}-]/gu, '');
  }

  function exportGroup(g: Group) {
    downloadCsv(`lira-isporaki-${slug(g.label)}.csv`, toCsv(rowsFor(g.rows)));
    toast(`Преземени испораки за ${g.label}`, 'success');
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

      <div className="mb-3 flex flex-wrap gap-1">
        {([
          { key: 'date', label: 'По датум' },
          { key: 'supplier', label: 'По добавувач' },
        ] as const).map((t) => (
          <button
            key={t.key}
            className={groupBy === t.key ? 'btn-ghost border-primary text-primary' : 'btn-ghost'}
            onClick={() => chooseGroupBy(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

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
        {groupBy === 'date' && (
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
        )}
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
            const open = openGroups.has(g.key);
            return (
              <div key={g.key} className="overflow-hidden rounded-xl border border-border">
                {/* Siblings, not nested — a button inside a button is invalid
                    and the inner one stops working. */}
                <div className="flex w-full items-center bg-surface pr-2">
                  <button
                    onClick={() => toggle(g.key)}
                    className="flex flex-1 items-center gap-3 px-4 py-3 text-left"
                  >
                    <IconChevron className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                    <span className="flex-1 font-bold">{g.label}</span>
                    <span className="text-xs text-muted">{g.rows.length} ставки</span>
                    {g.total > 0 && <span className="font-bold">{fmtMKD(g.total)}</span>}
                  </button>
                  <button
                    className="btn-ghost shrink-0 px-2 py-1 text-xs"
                    title={`Преземи CSV за ${g.label}`}
                    onClick={() => exportGroup(g)}
                  >
                    CSV
                  </button>
                </div>
                {open && (
                  <div className="overflow-x-auto border-t border-border">
                    <table className="w-full text-sm">
                      <thead className="border-b border-border text-left text-xs uppercase text-muted">
                        <tr>
                          <th className="p-3">{groupBy === 'supplier' ? 'Датум' : 'Час'}</th>
                          <th className="p-3">Производ</th>
                          <th className="p-3 text-right">Количина</th>
                          <th className="p-3 text-right">Цена</th>
                          {groupBy === 'date' && <th className="p-3">Добавувач</th>}
                          <th className="p-3"></th>
                        </tr>
                      </thead>
                      <tbody>
                        {g.rows.map((r) => (
                          <tr key={r.id} className="border-b border-border/60 last:border-0">
                            <td className="p-3 whitespace-nowrap text-muted">
                              {groupBy === 'supplier' ? fmtDate((r.created_at || '').slice(0, 10)) : fmtTime(r.created_at)}
                            </td>
                            <td className="p-3 font-semibold">{r.product?.name ?? '?'}</td>
                            <td className="p-3 text-right">{r.quantity} {r.product?.unit ?? ''}</td>
                            <td className="p-3 text-right">{r.cost_per_unit > 0 ? fmtMKD(r.cost_per_unit) : '—'}</td>
                            {groupBy === 'date' && <td className="p-3">{r.supplier ?? '—'}</td>}
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
