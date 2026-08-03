'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { createProduct, updateProduct } from '@/lib/services/products';
import type { Product } from '@/lib/types';
import { num } from '@/lib/format';

const UNITS = ['piece', 'kg', 'g', 'L', 'ml', 'portion', 'bottle', 'pack', 'box'];
const DEPARTMENTS = ['Кујна', 'Бар'];

/** Add (product=null) or edit an existing product. Calls onSaved after success. */
export function ProductDialog({
  open,
  product,
  onClose,
  onSaved,
}: {
  open: boolean;
  product: Product | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => blank(product));

  // Reset the form each time the dialog opens for a different product.
  const [lastId, setLastId] = useState<string | null>(product?.id ?? null);
  if (open && (product?.id ?? null) !== lastId) {
    setLastId(product?.id ?? null);
    setForm(blank(product));
  }

  const set = (patch: Partial<ReturnType<typeof blank>>) => setForm((f) => ({ ...f, ...patch }));

  async function save() {
    if (!form.name.trim()) return toast('Внеси назив', 'error');
    setSaving(true);
    try {
      const input = {
        name: form.name.trim(),
        category: form.category.trim() || 'Општо',
        unit: form.unit,
        department: form.department,
        current_stock: num(form.current_stock),
        min_stock: num(form.min_stock),
        cost_per_unit: num(form.cost_per_unit),
      };
      // Кало (yield/defrost/trim) and serving size aren't editable from this
      // form — only set sensible defaults on a brand new product, and leave an
      // existing one's Кало-page values alone. Resending 0s here on every save
      // used to silently wipe out whatever was set on the Кало page.
      if (product) await updateProduct(product.id, input);
      else
        await createProduct({
          ...input,
          kalo_defrost: 0,
          kalo_trim: 0,
          serving_size: null,
          serving_unit: null,
        });
      toast(product ? 'Зачувано' : 'Додадено', 'success');
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
      title={product ? 'Измени производ' : 'Нов производ'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Откажи</button>
          <button className="btn-primary" onClick={save} disabled={saving}>
            {saving ? 'Зачувување…' : 'Зачувај'}
          </button>
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
          <input className="input" value={form.category} onChange={(e) => set({ category: e.target.value })} />
        </div>
        <div>
          <label className="label">Оддел</label>
          <select className="input" value={form.department} onChange={(e) => set({ department: e.target.value })}>
            {DEPARTMENTS.map((d) => <option key={d}>{d}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Единица</label>
          <select className="input" value={form.unit} onChange={(e) => set({ unit: e.target.value })}>
            {UNITS.map((u) => <option key={u}>{u}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Цена по единица (ден)</label>
          <input className="input" type="number" step="0.01" value={form.cost_per_unit} onChange={(e) => set({ cost_per_unit: e.target.value })} />
        </div>
        <div>
          <label className="label">Тековна залиха</label>
          <input className="input" type="number" step="0.001" value={form.current_stock} onChange={(e) => set({ current_stock: e.target.value })} />
        </div>
        <div>
          <label className="label">Мин. залиха</label>
          <input className="input" type="number" step="0.001" value={form.min_stock} onChange={(e) => set({ min_stock: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}

function blank(p: Product | null) {
  return {
    name: p?.name ?? '',
    category: p?.category ?? '',
    department: (p?.department as string) ?? 'Кујна',
    unit: p?.unit ?? 'piece',
    cost_per_unit: String(p?.cost_per_unit ?? ''),
    current_stock: String(p?.current_stock ?? ''),
    min_stock: String(p?.min_stock ?? ''),
  };
}
