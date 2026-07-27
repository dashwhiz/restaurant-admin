'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { IconSearch } from '@/components/ui/Icons';
import { num, departmentOf } from '@/lib/format';
import { listProducts } from '@/lib/services/products';
import { submitStocktake, type StocktakeEntry } from '@/lib/services/stocktake';
import type { Product } from '@/lib/types';

export default function StocktakePage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState<'all' | 'Бар' | 'Кујна'>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setProducts(await listProducts());
      setCounts({});
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

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (dept !== 'all' && departmentOf(p.department || p.category) !== dept) return false;
      return true;
    });
  }, [products, query, dept]);

  const entered = Object.entries(counts).filter(([, v]) => v !== '');

  async function submit() {
    const entries: StocktakeEntry[] = entered
      .map(([id, v]) => {
        const p = products.find((x) => x.id === id)!;
        return { product_id: id, system_qty: p.current_stock, counted: num(v) };
      })
      .filter((e) => e.counted !== e.system_qty);
    if (!entries.length) return toast('Нема промени за зачувување', 'info');
    if (!confirm(`Ќе се ажурира залихата за ${entries.length} производи. Продолжи?`)) return;
    setSaving(true);
    try {
      const n = await submitStocktake(entries);
      toast(`Попис зачуван — ажурирани ${n} производи`, 'success');
      load();
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <PageHeader
        title="Попис"
        subtitle="Внеси избројана количина — залихата се поставува на неа"
        actions={
          <button className="btn-primary" onClick={submit} disabled={saving || entered.length === 0}>
            {saving ? 'Зачувување…' : `Зачувај (${entered.length})`}
          </button>
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

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface px-3">
        <IconSearch className="h-4 w-4 text-muted" />
        <input
          className="w-full bg-transparent py-2 text-sm outline-none"
          placeholder="Пребарувај производ…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-6 text-center text-sm text-muted">Вчитување…</p>
        ) : filtered.length === 0 ? (
          <EmptyState text="Нема производи" />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted">
              <tr>
                <th className="p-3">Производ</th>
                <th className="p-3 text-right">Систем</th>
                <th className="p-3 text-right">Избројано</th>
                <th className="p-3 text-right">Разлика</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const raw = counts[p.id] ?? '';
                const diff = raw === '' ? null : num(raw) - p.current_stock;
                return (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="p-3 font-semibold">{p.name} <span className="text-muted">{p.unit}</span></td>
                    <td className="p-3 text-right text-muted">{p.current_stock}</td>
                    <td className="p-3 text-right">
                      <input
                        className="input w-24 text-right"
                        type="number"
                        step="0.001"
                        value={raw}
                        onChange={(e) => setCounts((c) => ({ ...c, [p.id]: e.target.value }))}
                      />
                    </td>
                    <td className={`p-3 text-right font-medium ${diff == null ? 'text-muted' : diff < 0 ? 'text-danger' : diff > 0 ? 'text-success' : ''}`}>
                      {diff == null ? '—' : (diff > 0 ? '+' : '') + Number(diff.toFixed(3))}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
