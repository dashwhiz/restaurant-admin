'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { IconSearch } from '@/components/ui/Icons';
import { num, departmentOf } from '@/lib/format';
import { listProducts, setMinStocks } from '@/lib/services/products';
import { submitStocktake, type StocktakeEntry } from '@/lib/services/stocktake';
import type { Product } from '@/lib/types';

export default function StocktakePage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [counts, setCounts] = useState<Record<string, string>>({});
  const [mins, setMins] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState<'all' | 'Бар' | 'Кујна'>('all');
  // Most of the ~700 products sit at 0; these narrow the list to the ones worth checking.
  const [stockFilter, setStockFilter] = useState<'all' | 'nonzero' | 'negative'>('all');
  // Set on mount, not at render: a static export would bake in the build date.
  const [today, setToday] = useState('');
  const [countDate, setCountDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      setProducts(await listProducts());
      setCounts({});
      setMins({});
    } catch (e) {
      toast('Грешка при вчитување: ' + (e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    const d = new Date();
    const iso = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    setToday(iso);
    setCountDate(iso);
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (q && !p.name.toLowerCase().includes(q)) return false;
      if (dept !== 'all' && departmentOf(p.department || p.category) !== dept) return false;
      const stock = Number(p.current_stock) || 0;
      if (stockFilter === 'nonzero' && stock === 0) return false;
      if (stockFilter === 'negative' && stock >= 0) return false;
      return true;
    });
  }, [products, query, dept, stockFilter]);

  const entered = Object.entries(counts).filter(([, v]) => v !== '');
  // Only minimums that actually differ from what's saved count as changes.
  const minChanges = Object.entries(mins)
    .map(([id, v]) => ({ id, min_stock: num(v) }))
    .filter((c) => c.min_stock !== (Number(products.find((p) => p.id === c.id)?.min_stock) || 0));
  const pending = entered.length + minChanges.length;

  async function submit() {
    const entries: StocktakeEntry[] = entered
      .map(([id, v]) => {
        const p = products.find((x) => x.id === id)!;
        return { product_id: id, system_qty: p.current_stock, counted: num(v) };
      })
      .filter((e) => e.counted !== e.system_qty);
    if (!entries.length && !minChanges.length) return toast('Нема промени за зачувување', 'info');
    const backdated = countDate && countDate !== today;
    const when = backdated ? ` со датум ${countDate.split('-').reverse().join('.')}` : '';
    const parts = [
      entries.length ? `залихата за ${entries.length} производи${when}` : '',
      minChanges.length ? `минимумот за ${minChanges.length} производи` : '',
    ].filter(Boolean);
    if (!confirm(`Ќе се ажурира ${parts.join(' и ')}. Продолжи?`)) return;
    setSaving(true);
    try {
      // Today keeps the real save time; another day is stamped at midday.
      const n = entries.length ? await submitStocktake(entries, backdated ? countDate : undefined) : 0;
      if (minChanges.length) await setMinStocks(minChanges);
      const done = [n ? `залиха за ${n}` : '', minChanges.length ? `минимум за ${minChanges.length}` : '']
        .filter(Boolean)
        .join(', ');
      toast(`Зачувано — ${done} производи`, 'success');
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
        title="Залиха / Попис"
        subtitle="Внеси избројана количина — залихата се поставува на неа"
        actions={
          <>
            <label className="flex items-center gap-2 text-sm text-muted">
              Датум на попис
              <input
                className="input w-auto"
                type="date"
                value={countDate}
                max={today}
                onChange={(e) => setCountDate(e.target.value)}
              />
            </label>
            <button className="btn-primary" onClick={submit} disabled={saving || pending === 0}>
              {saving ? 'Зачувување…' : `Зачувај (${pending})`}
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
        <span className="mx-1 w-px self-stretch bg-border" />
        {([
          ['all', 'Сите залихи'],
          ['nonzero', 'Само со залиха'],
          ['negative', 'Само негативни'],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            className={stockFilter === key ? 'btn-ghost border-primary text-primary' : 'btn-ghost'}
            onClick={() => setStockFilter(key)}
          >
            {label}
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
                <th className="p-3 text-right">Минимум</th>
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
                    <td className="p-3 text-right">
                      {/* Empty means 0 — "don't track this product" on the dashboard. */}
                      <input
                        className="input w-24 text-right"
                        type="number"
                        step="0.001"
                        min="0"
                        value={mins[p.id] ?? (Number(p.min_stock) ? String(p.min_stock) : '')}
                        onChange={(e) => setMins((m) => ({ ...m, [p.id]: e.target.value }))}
                      />
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
