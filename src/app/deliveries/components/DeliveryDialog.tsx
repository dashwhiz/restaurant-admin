'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { createDelivery, updateDelivery, type DeliveryRow } from '@/lib/services/deliveries';
import type { Product } from '@/lib/types';
import { num } from '@/lib/format';
import { addVat, productVatRate, removeVat, VAT_RATES } from '@/lib/vat';

const money = (n: number) => String(Math.round(n * 100) / 100);

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

  // The two prices follow each other: typing one fills in the other. Changing
  // the rate keeps the price WITH VAT (what the invoice says) and recomputes the
  // one without — otherwise the two drift apart (Лепинја: 10.56 vs 12 at 5%).
  const setNet = (v: string) =>
    set({ cost_per_unit: v, price_with_ddv: v === '' ? '' : money(addVat(num(v), num(form.ddv_rate))) });
  const setGross = (v: string) =>
    set({ price_with_ddv: v, cost_per_unit: v === '' ? '' : money(removeVat(num(v), num(form.ddv_rate))) });
  const setRate = (r: string) =>
    setForm((f) =>
      f.price_with_ddv !== ''
        ? { ...f, ddv_rate: r, cost_per_unit: money(removeVat(num(f.price_with_ddv), num(r))) }
        : f.cost_per_unit !== ''
          ? { ...f, ddv_rate: r, price_with_ddv: money(addVat(num(f.cost_per_unit), num(r))) }
          : { ...f, ddv_rate: r },
    );

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
            // A new delivery starts at the product's known (or guessed) rate.
            // An edit keeps the invoice's rate even if the product is swapped.
            onChange={(e) => {
              const p = products.find((x) => x.id === e.target.value);
              set({ product_id: e.target.value });
              if (!delivery && p) setRate(String(productVatRate(p)));
            }}
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
          <input className="input" type="number" step="0.01" value={form.cost_per_unit} onChange={(e) => setNet(e.target.value)} />
        </div>
        <div>
          <label className="label">ДДВ %</label>
          <select className="input" value={form.ddv_rate} onChange={(e) => setRate(e.target.value)}>
            {VAT_RATES.map((r) => <option key={r} value={String(r)}>{r}%</option>)}
          </select>
        </div>
        <div>
          <label className="label">Цена со ДДВ</label>
          <input className="input" type="number" step="0.01" value={form.price_with_ddv} onChange={(e) => setGross(e.target.value)} />
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
