'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { createWaste, updateWaste, type WasteRow } from '@/lib/services/waste';
import type { Product } from '@/lib/types';
import { num } from '@/lib/format';

const REASONS = ['Расипано / истечено', 'Скршено', 'Подготовка', 'Грешка', 'Друго'];

export function WasteDialog({
  open,
  waste,
  products,
  onClose,
  onSaved,
}: {
  open: boolean;
  waste: WasteRow | null;
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => blank(waste));
  const [lastId, setLastId] = useState<string | null>(waste?.id ?? null);
  if (open && (waste?.id ?? null) !== lastId) {
    setLastId(waste?.id ?? null);
    setForm(blank(waste));
  }
  const set = (p: Partial<ReturnType<typeof blank>>) => setForm((f) => ({ ...f, ...p }));

  async function save() {
    if (!form.product_id) return toast('Избери производ', 'error');
    if (num(form.quantity) <= 0) return toast('Внеси количина', 'error');
    setSaving(true);
    try {
      const input = { product_id: form.product_id, quantity: num(form.quantity), reason: form.reason };
      if (waste) await updateWaste(waste.id, input);
      else await createWaste(input);
      toast('Отпадот е евидентиран', 'success');
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
      title={waste ? 'Измени отпад' : 'Нов отпад'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Откажи</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Зачувување…' : 'Зачувај'}</button>
        </>
      }
    >
      <div className="grid gap-3">
        <div>
          <label className="label">Производ</label>
          <select className="input" value={form.product_id} onChange={(e) => set({ product_id: e.target.value })}>
            <option value="">Избери…</option>
            {products.map((p) => <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>)}
          </select>
        </div>
        <div>
          <label className="label">Количина</label>
          <input className="input" type="number" step="0.001" value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} />
        </div>
        <div>
          <label className="label">Причина</label>
          <select className="input" value={form.reason} onChange={(e) => set({ reason: e.target.value })}>
            {REASONS.map((r) => <option key={r}>{r}</option>)}
          </select>
        </div>
      </div>
    </Modal>
  );
}

function blank(w: WasteRow | null) {
  return {
    product_id: w?.product_id ?? '',
    quantity: String(w?.quantity ?? ''),
    reason: w?.reason ?? REASONS[0],
  };
}
