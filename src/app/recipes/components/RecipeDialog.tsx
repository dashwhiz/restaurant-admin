'use client';

import { useRef, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { IconPlus, IconTrash } from '@/components/ui/Icons';
import { num } from '@/lib/format';
import { VAT_RATES, recipeVatRate } from '@/lib/vat';
import { ProductPicker } from './ProductPicker';
import {
  createRecipe,
  updateRecipe,
  setRecipeIngredients,
  type IngredientDraft,
} from '@/lib/services/recipes';
import { planNormativStock, applyNormativStock, type NormativStockChange } from '@/lib/services/normativ';
import type { Product, Recipe } from '@/lib/types';

const CATEGORIES = ['Храна', 'Пијалок', 'Десерт', 'Предјадење'];
const signed = (n: number) => (n > 0 ? '+' : '') + Number(n.toFixed(3));

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
  // Stock corrections waiting for the owner's choice; null = not asked yet.
  const [plan, setPlan] = useState<NormativStockChange[] | null>(null);
  // Bumped on every ingredient edit, so a plan that finishes loading after an
  // edit is thrown away instead of being applied to different ingredients.
  const edits = useRef(0);
  // Start fresh on EVERY open, not only when the recipe changes: the dialog
  // stays mounted, and a plan left over from the last save would otherwise
  // offer to apply the same correction a second time.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setForm(blank(recipe));
      setItems(toRows(initialIngredients));
      setPlan(null);
    }
  }
  const set = (p: Partial<ReturnType<typeof blank>>) => setForm((f) => ({ ...f, ...p }));

  // Any edit to the ingredients makes a shown correction stale.
  const editItems = (fn: (it: Row[]) => Row[]) => {
    edits.current++;
    setPlan(null);
    setItems(fn);
  };
  const addRow = () => editItems((it) => [...it, { product_id: '', quantity: '' }]);
  const setRow = (i: number, patch: Partial<Row>) =>
    editItems((it) => it.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => editItems((it) => it.filter((_, idx) => idx !== i));

  const drafts = (): IngredientDraft[] =>
    items
      .filter((i) => i.product_id && num(i.quantity) > 0)
      .map((i) => ({ product_id: i.product_id, quantity: num(i.quantity) }));

  // First click on an existing recipe: if the new normativ would change stock
  // already taken by past sales, show that and let the owner choose.
  async function save() {
    if (!form.name.trim()) return toast('Внеси назив', 'error');
    if (!recipe) return persist([]);
    setSaving(true);
    const startedAt = edits.current;
    try {
      const changes = await planNormativStock(new Map([[recipe.id, drafts()]]));
      if (edits.current !== startedAt) return; // edited meanwhile — press Зачувај again
      if (changes.length) setPlan(changes);
      else await persist([]);
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    } finally {
      setSaving(false);
    }
  }

  async function persist(fix: NormativStockChange[]) {
    setSaving(true);
    const name = form.name.trim();
    try {
      const input = {
        name,
        category: form.category.trim() || 'Храна',
        selling_price: num(form.selling_price),
        ddv_rate: num(form.ddv_rate),
      };
      const id = recipe ? (await updateRecipe(recipe.id, input), recipe.id) : (await createRecipe(input)).id;
      await setRecipeIngredients(id, drafts());
      setPlan(null);
      try {
        if (fix.length) await applyNormativStock(fix, name);
      } catch (e) {
        toast('Нормативот е зачуван, но поправката на залиха не успеа целосно: ' + (e as Error).message, 'error');
        onSaved();
        return onClose();
      }
      toast(fix.length ? `Зачувано — залихата е поправена за ${fix.length} производи` : recipe ? 'Зачувано' : 'Додадено', 'success');
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
        plan ? (
          <>
            <button className="btn-ghost" onClick={() => setPlan(null)} disabled={saving}>Назад</button>
            <button className="btn-ghost" onClick={() => persist([])} disabled={saving}>Само зачувај</button>
            <button className="btn-primary" onClick={() => persist(plan)} disabled={saving}>
              {saving ? 'Зачувување…' : 'Зачувај и поправи залиха'}
            </button>
          </>
        ) : (
          <>
            <button className="btn-ghost" onClick={onClose}>Откажи</button>
            <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Зачувување…' : 'Зачувај'}</button>
          </>
        )
      }
    >
      {plan && (
        <div className="mb-4 rounded-lg border border-warning/40 bg-warning/10 px-4 py-3 text-sm">
          <p className="font-semibold">⚠ Овој рецепт веќе е продаван — новиот норматив ја менува залихата</p>
          <ul className="mt-2 grid gap-0.5">
            {plan.map((c) => (
              <li key={c.productId} className="flex justify-between gap-3">
                <span>
                  {c.name} <span className="text-xs text-muted">({c.portions} порц.)</span>
                </span>
                <span className={`font-semibold ${c.delta < 0 ? 'text-danger' : 'text-success'}`}>
                  {signed(c.delta)} {c.unit}
                </span>
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-muted">
            <b>Зачувај и поправи залиха</b> — ако стариот норматив бил грешка. Се сметаат само продажбите после
            последниот попис на секој производ. <b>Само зачувај</b> — ако рецептот се менува од денес, а старите
            продажби биле точни (тогаш бришење стара продажба ќе врати по новиот норматив).
          </p>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Назив</label>
          <input className="input" value={form.name} onChange={(e) => set({ name: e.target.value })} autoFocus />
        </div>
        <div>
          <label className="label">Категорија</label>
          <select
            className="input"
            value={form.category}
            // A new recipe follows its category's usual rate; an existing one
            // keeps whatever rate was chosen for it.
            onChange={(e) =>
              set(recipe ? { category: e.target.value } : { category: e.target.value, ddv_rate: String(recipeVatRate({ category: e.target.value })) })
            }
          >
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Продажна цена со ДДВ (ден)</label>
          <input className="input" type="number" step="0.01" value={form.selling_price} onChange={(e) => set({ selling_price: e.target.value })} />
        </div>
        <div>
          <label className="label">ДДВ на продажба</label>
          <select className="input" value={form.ddv_rate} onChange={(e) => set({ ddv_rate: e.target.value })}>
            {VAT_RATES.map((r) => <option key={r} value={String(r)}>{r}%</option>)}
          </select>
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
                <ProductPicker
                  value={row.product_id}
                  products={products}
                  onChange={(next) => setRow(i, { product_id: next })}
                />
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
    ddv_rate: String(recipeVatRate({ ddv_rate: r?.ddv_rate, category: r?.category ?? 'Храна' })),
  };
}
