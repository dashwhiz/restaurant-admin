'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { IconSearch } from '@/components/ui/Icons';
import { num } from '@/lib/format';
import { listProducts, updateProduct } from '@/lib/services/products';
import type { Product } from '@/lib/types';

// Usable yield after defrosting and trimming losses.
const yieldPct = (defrost: number, trim: number) =>
  Math.round((1 - defrost / 100) * (1 - trim / 100) * 100);

interface Edit {
  defrost: string;
  trim: string;
}

export default function KaloPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [edits, setEdits] = useState<Record<string, Edit>>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const p = await listProducts();
      setProducts(p);
      setEdits(
        Object.fromEntries(
          p.map((x) => [x.id, { defrost: String(x.kalo_defrost ?? 0), trim: String(x.kalo_trim ?? 0) }]),
        ),
      );
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
    return q ? products.filter((p) => p.name.toLowerCase().includes(q)) : products;
  }, [products, query]);

  const changed = products.filter((p) => {
    const e = edits[p.id];
    return e && (num(e.defrost) !== (p.kalo_defrost ?? 0) || num(e.trim) !== (p.kalo_trim ?? 0));
  });

  async function saveAll() {
    setSaving(true);
    try {
      for (const p of changed) {
        const e = edits[p.id];
        const d = num(e.defrost);
        const t = num(e.trim);
        await updateProduct(p.id, { kalo_defrost: d, kalo_trim: t, yield_pct: yieldPct(d, t) });
      }
      toast(`Зачувани ${changed.length} производи`, 'success');
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
        title="Кало / Крш"
        subtitle="Загуба при подготовка (одмрзнување, транжирање). Не влијае на цената на готвење."
        actions={
          <button className="btn-primary" onClick={saveAll} disabled={saving || changed.length === 0}>
            {saving ? 'Зачувување…' : `Зачувај (${changed.length})`}
          </button>
        }
      />

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
                <th className="p-3 text-right">Одмрзнување %</th>
                <th className="p-3 text-right">Транжирање %</th>
                <th className="p-3 text-right">Искористливост</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const e = edits[p.id] ?? { defrost: '0', trim: '0' };
                return (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="p-3 font-semibold">{p.name}</td>
                    <td className="p-3 text-right">
                      <input
                        className="input w-20 text-right"
                        type="number"
                        value={e.defrost}
                        onChange={(ev) => setEdits((s) => ({ ...s, [p.id]: { ...e, defrost: ev.target.value } }))}
                      />
                    </td>
                    <td className="p-3 text-right">
                      <input
                        className="input w-20 text-right"
                        type="number"
                        value={e.trim}
                        onChange={(ev) => setEdits((s) => ({ ...s, [p.id]: { ...e, trim: ev.target.value } }))}
                      />
                    </td>
                    <td className="p-3 text-right font-medium">{yieldPct(num(e.defrost), num(e.trim))}%</td>
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
