'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { IconSearch } from '@/components/ui/Icons';
import { fmtMKD, num, departmentOf } from '@/lib/format';
import { listRecipes, listAllIngredients, updateRecipePrice, updateRecipeVat } from '@/lib/services/recipes';
import type { Recipe } from '@/lib/types';
import { VAT_RATES, addVat, productVatRate, recipeVatRate, removeVat } from '@/lib/vat';
import { useVat } from '@/components/layout/Vat';

interface Cost {
  net: number;
  gross: number;
}

export default function PricesPage() {
  const toast = useToast();
  const vat = useVat();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [costByRecipe, setCostByRecipe] = useState<Record<string, Cost>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [rates, setRates] = useState<Record<string, string>>({});
  const [rateFilter, setRateFilter] = useState<'all' | string>('all');
  const [query, setQuery] = useState('');
  const [dept, setDept] = useState<'all' | 'Бар' | 'Кујна'>('all');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [recs, ings] = await Promise.all([listRecipes(), listAllIngredients()]);
      // Food cost = Σ ingredient.quantity × product.cost_per_unit. No kalo factor.
      // Kept both ways: each ingredient carries its own purchase VAT rate.
      const cost: Record<string, Cost> = {};
      for (const i of ings) {
        const net = i.quantity * (i.product?.cost_per_unit ?? 0);
        const c = (cost[i.recipe_id] ??= { net: 0, gross: 0 });
        c.net += net;
        c.gross += i.product ? addVat(net, productVatRate(i.product)) : net;
      }
      setRecipes(recs);
      setCostByRecipe(cost);
      setPrices(Object.fromEntries(recs.map((r) => [r.id, String(r.selling_price ?? '')])));
      setRates(Object.fromEntries(recs.map((r) => [r.id, String(recipeVatRate(r))])));
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
    return recipes.filter((r) => {
      if (q && !r.name.toLowerCase().includes(q)) return false;
      if (dept !== 'all' && departmentOf(r.category) !== dept) return false;
      if (rateFilter !== 'all' && rates[r.id] !== rateFilter) return false;
      return true;
    });
  }, [recipes, query, dept, rateFilter, rates]);

  const priceChanged = (r: Recipe) => num(prices[r.id]) !== (r.selling_price ?? 0);
  const rateChanged = (r: Recipe) => num(rates[r.id]) !== recipeVatRate(r);
  const changed = recipes.filter((r) => priceChanged(r) || rateChanged(r));

  async function saveAll() {
    setSaving(true);
    try {
      for (const r of changed) {
        if (priceChanged(r)) await updateRecipePrice(r.id, num(prices[r.id]));
        if (rateChanged(r)) await updateRecipeVat(r.id, num(rates[r.id]));
      }
      toast(`Зачувани ${changed.length} цени`, 'success');
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
        title="Цени и food cost"
        subtitle="Продажна цена (со ДДВ, како во POS), трошок на состојки и маржа по рецепт. Маржата е секогаш без ДДВ."
        actions={
          <button className="btn-primary" onClick={saveAll} disabled={saving || changed.length === 0}>
            {saving ? 'Зачувување…' : `Зачувај (${changed.length})`}
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
            {d === 'all' ? 'Сите оддели' : d}
          </button>
        ))}
        <span className="mx-1 w-px self-stretch bg-border" />
        {['all', ...VAT_RATES.filter((r) => r > 0).map(String)].map((r) => (
          <button
            key={r}
            className={rateFilter === r ? 'btn-ghost border-primary text-primary' : 'btn-ghost'}
            onClick={() => setRateFilter(r)}
          >
            {r === 'all' ? 'Секој ДДВ' : `ДДВ ${r}%`}
          </button>
        ))}
      </div>

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface px-3">
        <IconSearch className="h-4 w-4 text-muted" />
        <input
          className="w-full bg-transparent py-2 text-sm outline-none"
          placeholder="Пребарувај рецепт…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto p-0">
        {loading ? (
          <p className="p-6 text-center text-sm text-muted">Вчитување…</p>
        ) : filtered.length === 0 ? (
          <EmptyState text="Нема рецепти" />
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-border text-left text-xs uppercase text-muted">
              <tr>
                <th className="p-3">Рецепт</th>
                <th className="p-3 text-right">Трошок {vat.label}</th>
                <th className="p-3 text-right">Цена со ДДВ</th>
                <th className="p-3 text-right">ДДВ</th>
                <th className="p-3 text-right">Маржа</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const cost = costByRecipe[r.id] ?? { net: 0, gross: 0 };
                const rate = num(rates[r.id]);
                // Margin without VAT on both sides — the VAT is not earnings.
                const priceNet = removeVat(num(prices[r.id]), rate);
                const margin = priceNet > 0 ? Math.round(((priceNet - cost.net) / priceNet) * 100) : null;
                return (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="p-3 font-semibold">{r.name}</td>
                    <td className="p-3 text-right text-muted">
                      {cost.net > 0 ? fmtMKD(vat.withVat ? cost.gross : cost.net) : '—'}
                    </td>
                    <td className="p-3 text-right">
                      <input
                        className="input w-28 text-right"
                        type="number"
                        step="0.01"
                        value={prices[r.id] ?? ''}
                        onChange={(e) => setPrices((p) => ({ ...p, [r.id]: e.target.value }))}
                      />
                      {!vat.withVat && priceNet > 0 && (
                        <span className="block text-xs text-muted">без ДДВ {fmtMKD(priceNet)}</span>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <select
                        className="input w-20"
                        value={rates[r.id] ?? ''}
                        onChange={(e) => setRates((x) => ({ ...x, [r.id]: e.target.value }))}
                        aria-label="ДДВ"
                      >
                        {VAT_RATES.map((v) => <option key={v} value={String(v)}>{v}%</option>)}
                      </select>
                    </td>
                    <td className="p-3 text-right">
                      {margin == null ? (
                        '—'
                      ) : (
                        <Badge tone={margin >= 60 ? 'green' : margin >= 30 ? 'yellow' : 'red'}>{margin}%</Badge>
                      )}
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
