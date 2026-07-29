'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { IconSearch } from '@/components/ui/Icons';
import { Badge } from '@/components/ui/Badge';
import { num, fmtMKD, departmentOf } from '@/lib/format';
import { listProducts, updateProduct } from '@/lib/services/products';
import { suggestKalo } from '@/lib/kaloDefaults';
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
  const [suggested, setSuggested] = useState<Record<string, boolean>>({});
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState<'all' | 'Бар' | 'Кујна'>('all');
  const [calcId, setCalcId] = useState('');
  const [calcQty, setCalcQty] = useState('200');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const p = await listProducts();
      setProducts(p);
      // Never configured (null, or still the untouched 0 default every
      // product is created with) → offer a researched starting point instead
      // of 0, if the name matches a known ingredient. Still just a suggestion
      // sitting in the edit box — nothing is written until Зачувај.
      const suggestions: Record<string, boolean> = {};
      setEdits(
        Object.fromEntries(
          p.map((x) => {
            const unset = !x.kalo_defrost && !x.kalo_trim;
            const guess = unset ? suggestKalo(x.name) : null;
            if (guess) suggestions[x.id] = true;
            return [
              x.id,
              { defrost: String(guess?.defrost ?? x.kalo_defrost ?? 0), trim: String(guess?.trim ?? x.kalo_trim ?? 0) },
            ];
          }),
        ),
      );
      setSuggested(suggestions);
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

  // Works backwards from a recipe portion to the raw quantity you must buy:
  // the portion is what's left AFTER defrost and trim losses.
  const calc = useMemo(() => {
    const product = products.find((p) => p.id === calcId);
    const qty = num(calcQty);
    if (!product || qty <= 0) return null;
    const defrost = product.kalo_defrost ?? 0;
    const trim = product.kalo_trim ?? 0;
    const totalYield = (1 - defrost / 100) * (1 - trim / 100);
    const raw = totalYield > 0 ? qty / totalYield : qty;
    const cost = product.cost_per_unit ?? 0;
    return {
      product,
      qty,
      defrost,
      trim,
      raw,
      lossPct: (1 - totalYield) * 100,
      costPortion: qty * cost,
      costRaw: raw * cost,
    };
  }, [products, calcId, calcQty]);

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
        subtitle="Загуба при подготовка (одмрзнување, транжирање). Не влијае на цената на готвење. Производи означени со „Предложено“ имаат автоматски предложена вредност — провери ја пред да зачуваш."
        actions={
          <button className="btn-primary" onClick={saveAll} disabled={saving || changed.length === 0}>
            {saving ? 'Зачувување…' : `Зачувај (${changed.length})`}
          </button>
        }
      />

      <div className="card mb-4">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">Калкулатор</h2>
        <p className="mb-3 text-xs text-muted">
          Колку сурово треба да набавиш за дадена порција во рецептот — порцијата е тоа што
          останува ПОСЛЕ одмрзнување и чистење.
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <select
            className="select sm:flex-1"
            aria-label="Производ"
            value={calcId}
            onChange={(e) => setCalcId(e.target.value)}
          >
            <option value="">Избери производ…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <input
            className="input sm:w-32"
            type="number"
            min="0"
            aria-label="Количина"
            value={calcQty}
            onChange={(e) => setCalcQty(e.target.value)}
          />
        </div>

        {calc && (
          <dl className="mt-3 grid gap-1 border-t border-border pt-3 text-sm">
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Порција во рецептот</dt>
              <dd className="font-semibold">{calc.qty} {calc.product.unit}</dd>
            </div>
            {calc.defrost > 0 && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Кало одмрзнување</dt>
                <dd className="text-warning">{calc.defrost}%</dd>
              </div>
            )}
            {calc.trim > 0 && (
              <div className="flex justify-between gap-2">
                <dt className="text-muted">Кало чистење</dt>
                <dd className="text-warning">{calc.trim}%</dd>
              </div>
            )}
            <div className="flex justify-between gap-2 border-t border-border pt-1">
              <dt className="font-semibold">Треба да набавиш</dt>
              <dd className="font-bold">
                {calc.raw.toFixed(1)} {calc.product.unit}
              </dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Вкупно кало</dt>
              <dd className={calc.lossPct > 0 ? 'text-danger' : ''}>{calc.lossPct.toFixed(1)}%</dd>
            </div>
            <div className="flex justify-between gap-2">
              <dt className="text-muted">Вистински кост</dt>
              <dd className="font-semibold">
                {fmtMKD(calc.costRaw)}
                {calc.costRaw > calc.costPortion && (
                  <span className="text-muted"> (наместо {fmtMKD(calc.costPortion)})</span>
                )}
              </dd>
            </div>
          </dl>
        )}
      </div>

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
                <th className="p-3 text-right">Одмрзнување %</th>
                <th className="p-3 text-right">Транжирање %</th>
                <th className="p-3 text-right">Искористливост</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((p) => {
                const e = edits[p.id] ?? { defrost: '0', trim: '0' };
                const isSuggested = suggested[p.id];
                return (
                  <tr key={p.id} className="border-b border-border/60 last:border-0">
                    <td className="p-3 font-semibold">
                      {p.name}
                      {isSuggested && (
                        <span className="ml-2" title="Автоматски предложена вредност — провери и зачувај">
                          <Badge tone="blue">Предложено</Badge>
                        </span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <input
                        className="input w-20 text-right"
                        type="number"
                        value={e.defrost}
                        onChange={(ev) => {
                          setSuggested((s) => (s[p.id] ? { ...s, [p.id]: false } : s));
                          setEdits((s) => ({ ...s, [p.id]: { ...e, defrost: ev.target.value } }));
                        }}
                      />
                    </td>
                    <td className="p-3 text-right">
                      <input
                        className="input w-20 text-right"
                        type="number"
                        value={e.trim}
                        onChange={(ev) => {
                          setSuggested((s) => (s[p.id] ? { ...s, [p.id]: false } : s));
                          setEdits((s) => ({ ...s, [p.id]: { ...e, trim: ev.target.value } }));
                        }}
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
