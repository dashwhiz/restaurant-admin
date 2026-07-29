'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { IconPlus, IconEdit, IconTrash, IconSearch } from '@/components/ui/Icons';
import { fmtMKD } from '@/lib/format';
import { listProducts } from '@/lib/services/products';
import {
  listRecipes,
  listAllIngredients,
  deleteRecipe,
  type IngredientRow,
  type IngredientDraft,
} from '@/lib/services/recipes';
import type { Product, Recipe } from '@/lib/types';
import { RecipeDialog } from './components/RecipeDialog';

export default function RecipesPage() {
  const toast = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState('');
  const [dialog, setDialog] = useState<{ open: boolean; recipe: Recipe | null }>({ open: false, recipe: null });

  async function load() {
    setLoading(true);
    try {
      const [r, p, ing] = await Promise.all([listRecipes(), listProducts(), listAllIngredients()]);
      setRecipes(r);
      setProducts(p);
      setIngredients(ing);
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

  const ingByRecipe = useMemo(() => {
    const m = new Map<string, IngredientRow[]>();
    for (const i of ingredients) {
      if (!m.has(i.recipe_id)) m.set(i.recipe_id, []);
      m.get(i.recipe_id)!.push(i);
    }
    return m;
  }, [ingredients]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recipes;
    return recipes.filter((r) => r.name.toLowerCase().includes(q) || r.category.toLowerCase().includes(q));
  }, [recipes, query]);

  const categories = useMemo(() => [...new Set(filtered.map((r) => r.category))], [filtered]);

  const dialogIngredients: IngredientDraft[] = dialog.recipe
    ? (ingByRecipe.get(dialog.recipe.id) ?? []).map((i) => ({ product_id: i.product_id, quantity: i.quantity }))
    : [];

  async function remove(r: Recipe) {
    if (!confirm(`Избриши рецепт "${r.name}"?\nОва ги брише и состојките и продажбите поврзани со него.`)) return;
    try {
      await deleteRecipe(r.id);
      toast('Избришано', 'success');
      load();
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    }
  }

  return (
    <>
      <PageHeader
        title="Рецепти"
        subtitle="Јадења и пијалоци што се продаваат"
        actions={
          <button className="btn-primary" onClick={() => setDialog({ open: true, recipe: null })}>
            <IconPlus className="h-4 w-4" /> Нов рецепт
          </button>
        }
      />

      <div className="mb-4 flex items-center gap-2 rounded-lg border border-border bg-surface px-3">
        <IconSearch className="h-4 w-4 text-muted" />
        <input
          className="w-full bg-transparent py-2 text-sm outline-none"
          placeholder="Пребарувај по назив или категорија…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {loading ? (
        <p className="text-sm text-muted">Вчитување…</p>
      ) : recipes.length === 0 ? (
        <div className="card"><EmptyState text="Сè уште нема рецепти" /></div>
      ) : filtered.length === 0 ? (
        <div className="card"><EmptyState text="Нема резултати" /></div>
      ) : (
        categories.map((cat) => (
          <div key={cat} className="mb-6">
            <h2 className="mb-2 text-xs font-bold uppercase tracking-wide text-muted">{cat}</h2>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {filtered.filter((r) => r.category === cat).map((r) => {
                const ings = ingByRecipe.get(r.id) ?? [];
                return (
                  <div key={r.id} className="card">
                    <div className="mb-2 flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-bold">{r.name}</h3>
                        {r.selling_price > 0 && <Badge tone="yellow">{fmtMKD(r.selling_price)}</Badge>}
                      </div>
                      <div className="flex gap-1">
                        <button className="btn-ghost px-2 py-1" onClick={() => setDialog({ open: true, recipe: r })} aria-label="Измени">
                          <IconEdit className="h-4 w-4" />
                        </button>
                        <button className="btn-ghost px-2 py-1 text-danger" onClick={() => remove(r)} aria-label="Избриши">
                          <IconTrash className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    {ings.length === 0 ? (
                      <p className="text-xs text-muted">Нема дефинирани состојки</p>
                    ) : (
                      <ul className="text-sm">
                        {ings.map((i) => (
                          <li key={i.id} className="flex justify-between border-b border-border/50 py-1 last:border-0">
                            <span>{i.product?.name ?? '?'}</span>
                            <span className="text-muted">{i.quantity} {i.product?.unit ?? ''}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      <RecipeDialog
        open={dialog.open}
        recipe={dialog.recipe}
        products={products}
        initialIngredients={dialogIngredients}
        onClose={() => setDialog({ open: false, recipe: null })}
        onSaved={load}
      />
    </>
  );
}
