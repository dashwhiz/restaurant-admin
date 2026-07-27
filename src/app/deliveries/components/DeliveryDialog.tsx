'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { createDelivery, updateDelivery, type DeliveryRow } from '@/lib/services/deliveries';
import type { Product } from '@/lib/types';
import { num } from '@/lib/format';

export function DeliveryDialog({
  open,
  delivery,
  products,
  onClose,
  onSaved,
}: {
  open: boolean;
  delivery: DeliveryRow | null;
  products: Product[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => blank(delivery));
  const [lastId, setLastId] = useState<string | null>(delivery?.id ?? null);
  if (open && (delivery?.id ?? null) !== lastId) {
    setLastId(delivery?.id ?? null);
    setForm(blank(delivery));
  }
  const set = (p: Partial<ReturnType<typeof blank>>) => setForm((f) => ({ ...f, ...p }));

  async function save() {
    if (!form.product_id) return toast('Избери производ', 'error');
    if (num(form.quantity) <= 0) return toast('Внеси количина', 'error');
    setSaving(true);
    try {
      const input = {
        product_id: form.product_id,
        quantity: num(form.quantity),
        cost_per_unit: num(form.cost_per_unit),
        ddv_rate: num(form.ddv_rate),
        price_with_ddv: num(form.price_with_ddv),
        supplier: form.supplier.trim() || null,
        notes: form.notes.trim() || null,
      };
      if (delivery) await updateDelivery(delivery.id, input);
      else await createDelivery(input);
      toast('Зачувано — залихата е ажурирана', 'success');
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
      title={delivery ? 'Измени испорака' : 'Нова испорака'}
      footer={
        <>
          <button className="btn-ghost" onClick={onClose}>Откажи</button>
          <button className="btn-primary" onClick={save} disabled={saving}>{saving ? 'Зачувување…' : 'Зачувај'}</button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-3">
        <div className="col-span-2">
          <label className="label">Производ</label>
          <select
            className="input"
            value={form.product_id}
            disabled={!!delivery}
            onChange={(e) => set({ product_id: e.target.value })}
          >
            <option value="">Избери…</option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>{p.name} ({p.unit})</option>
            ))}
          </select>
        </div>
        <div>
          <label className="label">Количина</label>
          <input className="input" type="number" step="0.001" value={form.quantity} onChange={(e) => set({ quantity: e.target.value })} autoFocus />
        </div>
        <div>
          <label className="label">Цена/ед. (без ДДВ)</label>
          <input className="input" type="number" step="0.01" value={form.cost_per_unit} onChange={(e) => set({ cost_per_unit: e.target.value })} />
        </div>
        <div>
          <label className="label">ДДВ %</label>
          <select className="input" value={form.ddv_rate} onChange={(e) => set({ ddv_rate: e.target.value })}>
            {['0', '5', '10', '18'].map((r) => <option key={r} value={r}>{r}%</option>)}
          </select>
        </div>
        <div>
          <label className="label">Цена со ДДВ</label>
          <input className="input" type="number" step="0.01" value={form.price_with_ddv} onChange={(e) => set({ price_with_ddv: e.target.value })} />
        </div>
        <div>
          <label className="label">Добавувач</label>
          <input className="input" value={form.supplier} onChange={(e) => set({ supplier: e.target.value })} />
        </div>
        <div>
          <label className="label">Забелешка</label>
          <input className="input" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </div>
      </div>
    </Modal>
  );
}

function blank(d: DeliveryRow | null) {
  return {
    product_id: d?.product_id ?? '',
    quantity: String(d?.quantity ?? ''),
    cost_per_unit: String(d?.cost_per_unit ?? ''),
    ddv_rate: String(d?.ddv_rate ?? '0'),
    price_with_ddv: String(d?.price_with_ddv ?? ''),
    supplier: d?.supplier ?? '',
    notes: d?.notes ?? '',
  };
}
