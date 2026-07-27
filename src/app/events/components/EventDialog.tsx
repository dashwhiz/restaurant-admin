'use client';

import { useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { useToast } from '@/components/ui/Toast';
import { IconPlus, IconTrash } from '@/components/ui/Icons';
import { num } from '@/lib/format';
import { createEvent, updateEvent, setEventMenu, type MenuDraft } from '@/lib/services/events';
import type { EventRow, Recipe } from '@/lib/types';

const TYPES = ['Свадба', 'Прослава', 'Кетеринг', 'Специјална нарачка', 'Друго'];

export function EventDialog({
  open,
  event,
  recipes,
  initialMenu,
  onClose,
  onSaved,
}: {
  open: boolean;
  event: EventRow | null;
  recipes: Recipe[];
  initialMenu: MenuDraft[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const toast = useToast();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => blank(event));
  const [menu, setMenu] = useState<MenuDraft[]>(initialMenu);
  const [lastId, setLastId] = useState<string | null>(event?.id ?? null);
  if (open && (event?.id ?? null) !== lastId) {
    setLastId(event?.id ?? null);
    setForm(blank(event));
    setMenu(initialMenu);
  }
  const set = (p: Partial<ReturnType<typeof blank>>) => setForm((f) => ({ ...f, ...p }));
  const addRow = () => setMenu((m) => [...m, { recipe_id: '', qty_per_person: 1 }]);
  const setRow = (i: number, patch: Partial<MenuDraft>) =>
    setMenu((m) => m.map((r, idx) => (idx === i ? { ...r, ...patch } : r)));
  const removeRow = (i: number) => setMenu((m) => m.filter((_, idx) => idx !== i));

  async function save() {
    if (!form.name.trim()) return toast('Внеси назив', 'error');
    const items = menu.filter((i) => i.recipe_id && num(i.qty_per_person) > 0);
    setSaving(true);
    try {
      const input = {
        name: form.name.trim(),
        type: form.type,
        event_date: form.event_date || null,
        guest_count: Math.max(1, parseInt(form.guest_count, 10) || 1),
        price_per_person: num(form.price_per_person),
        notes: form.notes.trim() || null,
      };
      const id = event ? (await updateEvent(event.id, input), event.id) : (await createEvent(input)).id;
      await setEventMenu(id, items.map((i) => ({ recipe_id: i.recipe_id, qty_per_person: num(i.qty_per_person) })));
      toast(event ? 'Зачувано' : 'Додадено', 'success');
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
      title={event ? 'Измени настан' : 'Нов настан'}
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
          <label className="label">Тип</label>
          <select className="input" value={form.type} onChange={(e) => set({ type: e.target.value })}>
            {TYPES.map((t) => <option key={t}>{t}</option>)}
          </select>
        </div>
        <div>
          <label className="label">Датум</label>
          <input className="input" type="date" value={form.event_date} onChange={(e) => set({ event_date: e.target.value })} />
        </div>
        <div>
          <label className="label">Гости</label>
          <input className="input" type="number" min="1" value={form.guest_count} onChange={(e) => set({ guest_count: e.target.value })} />
        </div>
        <div>
          <label className="label">Цена по гостин</label>
          <input className="input" type="number" step="0.01" value={form.price_per_person} onChange={(e) => set({ price_per_person: e.target.value })} />
        </div>
        <div className="col-span-2">
          <label className="label">Забелешка</label>
          <input className="input" value={form.notes} onChange={(e) => set({ notes: e.target.value })} />
        </div>
      </div>

      <div className="mt-4">
        <div className="mb-1 flex items-center justify-between">
          <label className="label mb-0">Мени (по гостин)</label>
          <button className="btn-ghost px-2 py-1 text-xs" onClick={addRow}>
            <IconPlus className="h-3.5 w-3.5" /> Додај
          </button>
        </div>
        {menu.length === 0 && <p className="py-2 text-xs text-muted">Нема ставки во менито.</p>}
        <div className="flex flex-col gap-2">
          {menu.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <select className="input flex-1" value={row.recipe_id} onChange={(e) => setRow(i, { recipe_id: e.target.value })}>
                <option value="">Рецепт…</option>
                {recipes.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
              <input
                className="input w-24"
                type="number"
                step="0.01"
                placeholder="по гостин"
                value={row.qty_per_person || ''}
                onChange={(e) => setRow(i, { qty_per_person: num(e.target.value) })}
              />
              <button className="btn-ghost px-2 py-2 text-danger" onClick={() => removeRow(i)} aria-label="Отстрани">
                <IconTrash className="h-4 w-4" />
              </button>
            </div>
          ))}
        </div>
      </div>
    </Modal>
  );
}

function blank(e: EventRow | null) {
  return {
    name: e?.name ?? '',
    type: e?.type ?? TYPES[0],
    event_date: e?.event_date ?? '',
    guest_count: String(e?.guest_count ?? '1'),
    price_per_person: String(e?.price_per_person ?? ''),
    notes: e?.notes ?? '',
  };
}
