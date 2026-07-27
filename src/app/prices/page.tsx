'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { IconSearch } from '@/components/ui/Icons';
import { fmtMKD, num } from '@/lib/format';
import { listRecipes, listAllIngredients, updateRecipePrice } from '@/lib/services/recipes';
import type { Recipe } from '@/lib/types';

export default function PricesPage() {
  const toast = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [costByRecipe, setCostByRecipe] = useState<Record<string, number>>({});
  const [prices, setPrices] = useState<Record<string, string>>({});
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const [recs, ings] = await Promise.all([listRecipes(), listAllIngredients()]);
      // Food cost = Σ ingredient.quantity × product.cost_per_unit. No kalo factor.
      const cost: Record<string, number> = {};
      for (const i of ings) {
        cost[i.recipe_id] = (cost[i.recipe_id] ?? 0) + i.quantity * (i.product?.cost_per_unit ?? 0);
      }
      setRecipes(recs);
      setCostByRecipe(cost);
      setPrices(Object.fromEntries(recs.map((r) => [r.id, String(r.selling_price ?? '')])));
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
    return q ? recipes.filter((r) => r.name.toLowerCase().includes(q)) : recipes;
  }, [recipes, query]);

  const changed = recipes.filter((r) => num(prices[r.id]) !== (r.selling_price ?? 0));

  async function saveAll() {
    setSaving(true);
    try {
      for (const r of changed) await updateRecipePrice(r.id, num(prices[r.id]));
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
        subtitle="Продажна цена, трошок на состојки и маржа по рецепт"
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
                <th className="p-3 text-right">Трошок</th>
                <th className="p-3 text-right">Цена</th>
                <th className="p-3 text-right">Маржа</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => {
                const cost = costByRecipe[r.id] ?? 0;
                const price = num(prices[r.id]);
                const margin = price > 0 ? Math.round(((price - cost) / price) * 100) : null;
                return (
                  <tr key={r.id} className="border-b border-border/60 last:border-0">
                    <td className="p-3 font-semibold">{r.name}</td>
                    <td className="p-3 text-right text-muted">{cost > 0 ? fmtMKD(cost) : '—'}</td>
                    <td className="p-3 text-right">
                      <input
                        className="input w-28 text-right"
                        type="number"
                        step="0.01"
                        value={prices[r.id] ?? ''}
                        onChange={(e) => setPrices((p) => ({ ...p, [r.id]: e.target.value }))}
                      />
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
