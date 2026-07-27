'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { IconPlus, IconEdit, IconTrash, IconSearch } from '@/components/ui/Icons';
import { fmtMKD, departmentOf } from '@/lib/format';
import { exportCsv } from '@/lib/csv';
import { listProducts, deleteProduct } from '@/lib/services/products';
import type { Product } from '@/lib/types';
import { ProductDialog } from './components/ProductDialog';

export default function ProductsPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  // Same three filters the old app had above this table.
  const [dept, setDept] = useState<'all' | 'Бар' | 'Кујна'>('all');
  const [category, setCategory] = useState('all');
  const [status, setStatus] = useState<'all' | 'low' | 'out' | 'ok'>('all');
  const [dialog, setDialog] = useState<{ open: boolean; product: Product | null }>({
    open: false,
    product: null,
  });

  async function load() {
    setLoading(true);
    try {
      setProducts(await listProducts());
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

  const categories = useMemo(
    () => [...new Set(products.map((p) => p.category).filter(Boolean))].sort(),
    [products],
  );

  function statusOf(p: Product): 'out' | 'low' | 'ok' {
    if (p.current_stock <= 0) return 'out';
    if (p.min_stock > 0 && p.current_stock <= p.min_stock) return 'low';
    return 'ok';
  }

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q) && !p.category.toLowerCase().includes(q)) return false;
      if (dept !== 'all' && departmentOf(p.department || p.category) !== dept) return false;
      if (category !== 'all' && p.category !== category) return false;
      if (status !== 'all' && statusOf(p) !== status) return false;
      return true;
    });
  }, [products, query, dept, category, status]);

  async function remove(p: Product) {
    if (!confirm(`Избриши "${p.name}"?\nОва ги брише и поврзаните записи.`)) return;
    try {
      await deleteProduct(p.id);
      toast('Избришано', 'success');
      load();
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    }
  }

  function exportRows() {
    const n = exportCsv(
      'proizvodi',
      filtered.map((p) => ({
        назив: p.name,
        категорија: p.category,
        оддел: p.department,
        единица: p.unit,
        залиха: p.current_stock,
        минимум: p.min_stock,
        цена_по_единица: p.cost_per_unit,
      })),
    );
    toast(n > 0 ? `Преземени ${n} производи` : 'Нема што да се преземе', n > 0 ? 'success' : 'error');
  }

  return (
    <>
      <PageHeader
        title="Производи"
        subtitle="Суровини и артикли со залиха"
        actions={
          <>
          <button className="btn-ghost" onClick={exportRows} disabled={filtered.length === 0}>
            CSV
          </button>
          <button className="btn-primary" onClick={() => setDialog({ open: true, product: null })}>
            <IconPlus className="h-4 w-4" /> Нов производ
          </button>
          </>
        }
      />

      <div className="mb-3 flex flex-wrap gap-1">
        {(['all', 'Бар', 'Кујна'] as const).map((d) => (
          <button
            key={d}
            className={dept === d ? 'btn-ghost border-primary text-primary' : 'btn-ghost'}
            onClick={() => setDept(d)}
          >
            {d === 'all' ? 'Сите' : d}
          </button>
        ))}
      </div>

      <div className="mb-4 flex flex-col gap-2 sm:flex-row">
        <div className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface px-3">
          <IconSearch className="h-4 w-4 text-muted" />
          <input
            className="w-full bg-transparent py-2 text-sm outline-none"
            placeholder="Пребарувај по назив или категорија…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        <select
          className="select w-auto"
          aria-label="Категорија"
          value={category}
          onChange={(e) => setCategory(e.target.value)}
        >
          <option value="all">Сите категории</option>
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
        <select
          className="select w-auto"
          aria-label="Статус"
          value={status}
          onChange={(e) => setStatus(e.target.value as typeof status)}
        >
          <option value="all">Сите статуси</option>
          <option value="low">Мала залиха</option>
          <option value="out">Нема залиха</option>
          <option value="ok">Во ред</option>
        </select>
      </div>

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-6 text-center text-sm text-muted">Вчитување…</p>
        ) : filtered.length === 0 ? (
          <EmptyState text={query ? 'Нема резултати' : 'Сè уште нема производи'} />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted">
              <tr>
                <th className="p-3">Назив</th>
                <th className="p-3">Категорија</th>
                <th className="p-3 text-right">Залиха</th>
                <th className="p-3 text-right">Цена</th>
                <th className="p-3">Статус</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const out = p.current_stock <= 0;
                const low = !out && p.min_stock > 0 && p.current_stock <= p.min_stock;
                return (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="p-3 font-semibold">{p.name}</td>
                    <td className="p-3">
                      <Badge tone="blue">{p.category}</Badge>
                    </td>
                    <td className="p-3 text-right font-medium">
                      {p.current_stock} {p.unit}
                    </td>
                    <td className="p-3 text-right">{p.cost_per_unit > 0 ? fmtMKD(p.cost_per_unit) : '—'}</td>
                    <td className="p-3">
                      {out ? <Badge tone="red">Нема</Badge> : low ? <Badge tone="yellow">Малку</Badge> : <Badge tone="green">Во ред</Badge>}
                    </td>
                    <td className="p-3">
                      <div className="flex justify-end gap-1">
                        <button className="btn-ghost px-2 py-1" onClick={() => setDialog({ open: true, product: p })} aria-label="Измени">
                          <IconEdit className="h-4 w-4" />
                        </button>
                        <button className="btn-ghost px-2 py-1 text-danger" onClick={() => remove(p)} aria-label="Избриши">
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

      <ProductDialog
        open={dialog.open}
        product={dialog.product}
        onClose={() => setDialog({ open: false, product: null })}
        onSaved={load}
      />
    </>
  );
}
