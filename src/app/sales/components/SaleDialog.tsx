'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { createSale, updateSale, type SaleRow } from '@/lib/services/sales';
import type { Recipe } from '@/lib/types';

export function SaleDialog({
  open,
  sale,
  recipes,
  onClose,
  onSaved,
}: {
  open: boolean;
  sale: SaleRow | null;
  recipes: Recipe[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => blank(sale));
  const [lastId, setLastId] = useState<string | null>(sale?.id ?? null);
  if (open && (sale?.id ?? null) !== lastId) {
    setLastId(sale?.id ?? null);
    setForm(blank(sale));
  }
  const set = (p: Partial<ReturnType<typeof blank>>) => setForm((f) => ({ ...f, ...p }));

  async function save() {
    if (!form.recipe_id) return toast('Избери рецепт', 'error');
    const qty = parseInt(form.quantity, 10) || 1;
    setSaving(true);
    try {
      const input = { recipe_id: form.recipe_id, quantity: qty, notes: form.notes.trim() || null };
      if (sale) await updateSale(sale.id, input);
      else await createSale(input);
      toast('Продажбата е запишана, залихата е намалена', 'success');
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
      title={sale ? 'Измени продажба' : 'Нова продажба'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Откажи</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Зачувување…' : 'Зачувај'}</button>
        </>
      }
    >
      <div className="grid gap-3">
        <div>
          <label className="label">Рецепт</label>
          <select className="input" value={form.recipe_id} onChange={(e) => set({ recipe_id: e.target.value })}>
            <option value="">Избери…</option>
            {recipes.map((r) => <option key={r.id} value={r.id}>{r.name} ({r.category})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Количина</label>
          <input className="input" type="number" min="1" value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} />
        </div>
        <div>
          <label className="label">Забелешка</label>
          <input className="input" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}

function blank(s: SaleRow | null) {
  return {
    recipe_id: s?.recipe_id ?? '',
    quantity: String(s?.quantity ?? '1'),
    notes: s?.notes ?? '',
  };
}
