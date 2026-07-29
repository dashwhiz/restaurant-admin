'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { IconPlus, IconTrash } from '@/components/ui/Icons';
import { num } from '@/lib/format';
import {
  createRecipe,
  updateRecipe,
  setRecipeIngredients,
  type IngredientDraft,
} from '@/lib/services/recipes';
import type { Product, Recipe } from '@/lib/types';

const CATEGORIES = ['Храна', 'Пијалок', 'Десерт', 'Предјадење'];

// Quantity kept as a string while editing — a controlled number input that
// parses on every keystroke snaps "0" back to "" (0 is falsy), which makes it
// impossible to type a leading "0." before something like 0.05.
interface Row {
  product_id: string;
  quantity: string;
}

const toRows = (items: IngredientDraft[]): Row[] =>
  items.map((i) => ({ product_id: i.product_id, quantity: i.quantity ? String(i.quantity) : '' }));

export function RecipeDialog({
  open,
  recipe,
  products,
  initialIngredients,
  onClose,
  onSaved,
}: {
  open: boolean;
  recipe: Recipe | null;
  products: Product[];
  initialIngredients: IngredientDraft[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => blank(recipe));
  const [items, setItems] = useState<Row[]>(() => toRows(initialIngredients));
  const [lastId, setLastId] = useState<string | null>(recipe?.id ?? null);
  if (open && (recipe?.id ?? null) !== lastId) {
    setLastId(recipe?.id ?? null);
    setForm(blank(recipe));
    setItems(toRows(initialIngredients));
  }
  const set = (p: Partial<ReturnType<typeof blank>>) => setForm((f) => ({ ...f, ...p }));

  const addRow = () => setItems((it) => [...it, { product_id: '', quantity: '' }]);
  const setRow = (i: number, patch: Partial<Row>) =>
    setItems((it) => it.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => setItems((it) => it.filter((_, idx) => idx !== i));

  async function save() {
    if (!form.name.trim()) return toast('Внеси назив', 'error');
    const ings = items.filter((i) => i.product_id && num(i.quantity) > 0);
    setSaving(true);
    try {
      const input = {
        name: form.name.trim(),
        category: form.category.trim() || 'Храна',
        selling_price: num(form.selling_price),
      };
      const id = recipe ? (await updateRecipe(recipe.id, input), recipe.id) : (await createRecipe(input)).id;
      await setRecipeIngredients(id, ings.map((i): IngredientDraft => ({ product_id: i.product_id, quantity: num(i.quantity) })));
      toast(recipe ? 'Зачувано' : 'Додадено', 'success');
      onSaved();
      onClose();
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={recipe ? 'Измени рецепт' : 'Нов рецепт'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Откажи</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Зачувување…' : 'Зачувај'}</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Назив</label>
          <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
        </div>
        <div>
          <label className="label">Категорија</label>
          <select className="input" value={form.category} onChange={(e) => set({ category: e.target.value })}>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Продажна цена (ден)</label>
          <input className="input" type="number" step="0.01" value={form.selling_price} onChange={(e) => set({ selling_price: e.target.value })} />
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <label className="label mb-0">Состојки</label>
          <button className="btn-ghost px-2 py-1 text-xs" onClick={addRow}>
            <IconPlus className="h-3.5 w-3.5" /> Додај
          </button>
        </div>
        {items.length === 0 && <p className="py-2 text-xs text-muted">Нема состојки.</p>}
        <div className="flex flex-col gap-2">
          {items.map((row, i) => {
            const unit = products.find((p) => p.id === row.product_id)?.unit;
            return (
              <div key={i} className="flex items-center gap-2">
                <select
                  className="input flex-1"
                  value={row.product_id}
                  onChange={(e) => setRow(i, { product_id: e.target.value })}
                >
                  <option value="">Производ…</option>
                  {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
                </select>
                <div className="relative">
                  <input
                    className={`input w-24 ${unit ? 'pr-10' : ''}`}
                    type="number"
                    step="0.001"
                    placeholder="кол."
                    value={row.quantity}
                    onChange={(e) => setRow(i, { quantity: e.target.value })}
                  />
                  {unit && (
                    <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted">
                      {unit}
                    </span>
                  )}
                </div>
                <button className="btn-ghost px-2 py-2 text-danger" onClick={() => removeRow(i)} aria-label="Отстрани">
                  <IconTrash className="h-4 w-4" />
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </Modal>
  );
}

function blank(r: Recipe | null) {
  return {
    name: r?.name ?? '',
    category: r?.category ?? 'Храна',
    selling_price: String(r?.selling_price ?? ''),
  };
}
