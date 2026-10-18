// Catering events. Completing an event deducts its menu's ingredients from
// stock; deleting a completed event returns them. All via the stock helper.
import { getSupabase } from '@/lib/supabase';
import { fmtMKD } from '@/lib/format';
import type { EventRow, EventMenuItem } from '@/lib/types';
import { applyRecipeStock } from './stock';

export interface EventInput {
  name: string;
  type: string;
  event_date: string | null;
  guest_count: number;
  price_per_person: number;
  notes: string | null;
}

export interface MenuItemRow extends EventMenuItem {
  recipe?: { name: string } | null;
}

export interface MenuDraft {
  recipe_id: string;
  qty_per_person: number;
}

export async function listEvents(): Promise<EventRow[]> {
  const { data, error } = await getSupabase()
    .from('events')
    .select('*')
    .order('event_date', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false });
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

export async function listEventMenus(): Promise<MenuItemRow[]> {
  const { data, error } = await getSupabase()
    .from('event_menu_items')
    .select('*, recipe:recipes(name)');
  if (error) throw error;
  return (data ?? []) as MenuItemRow[];
}

export async function createEvent(input: EventInput): Promise<EventRow> {
  const { data, error } = await getSupabase().from('events').insert(input).select().single();
  if (error) throw error;
  return data as EventRow;
}

export const SPECIAL_ORDER_TYPE = 'Специјална нарачка';

export interface PosSpecial {
  date: string;
  name: string;
  qty: number;
  amount: number;
}

/**
 * Turn POS "special order" lines into events (menu left empty, to be filled
 * in Настани). A line whose event already exists — same name, date and type —
 * is skipped, so re-importing a day or clicking twice makes no duplicates.
 * Returns how many were created and how many already existed.
 */
export async function createEventsFromPos(specials: PosSpecial[]): Promise<{ created: number; existing: number }> {
  if (specials.length === 0) return { created: 0, existing: 0 };
  const dates = [...new Set(specials.map((s) => s.date))];
  const { data, error } = await getSupabase()
    .from('events')
    .select('name, event_date')
    .eq('type', SPECIAL_ORDER_TYPE)
    .in('event_date', dates);
  if (error) throw error;
  const key = (name: string, date: string | null) => `${date}|${name}`;
  const seen = new Set((data ?? []).map((e) => key(e.name, e.event_date)));

  const rows: EventInput[] = [];
  for (const s of specials) {
    const k = key(s.name, s.date);
    if (seen.has(k)) continue;
    seen.add(k);
    rows.push({
      name: s.name,
      type: SPECIAL_ORDER_TYPE,
      event_date: s.date,
      guest_count: Math.max(1, Math.round(s.qty)),
      price_per_person: s.qty > 0 ? Number((s.amount / s.qty).toFixed(2)) : 0,
      notes: `Од POS увоз (${s.date}) · вкупно ${fmtMKD(s.amount)}`,
    });
  }
  if (rows.length) {
    const { error: insErr } = await getSupabase().from('events').insert(rows);
    if (insErr) throw insErr;
  }
  return { created: rows.length, existing: specials.length - rows.length };
}

export async function updateEvent(id: string, input: EventInput): Promise<void> {
  const { error } = await getSupabase().from('events').update(input).eq('id', id);
  if (error) throw error;
}

/** Replace an event's menu wholesale. */
export async function setEventMenu(eventId: string, items: MenuDraft[]): Promise<void> {
  const sb = getSupabase();
  const { error: delErr } = await sb.from('event_menu_items').delete().eq('event_id', eventId);
  if (delErr) throw delErr;
  if (items.length) {
    const rows = items.map((i) => ({ event_id: eventId, recipe_id: i.recipe_id, qty_per_person: i.qty_per_person }));
    const { error } = await sb.from('event_menu_items').insert(rows);
    if (error) throw error;
  }
}

/** Mark an event done and deduct its menu's ingredients from stock. */
export async function completeEvent(ev: EventRow, menu: MenuItemRow[]): Promise<void> {
  const sb = getSupabase();
  const guests = ev.guest_count || 1;
  for (const item of menu) {
    await applyRecipeStock(item.recipe_id, item.qty_per_person * guests);
  }
  const { error } = await sb.from('events').update({ status: 'done' }).eq('id', ev.id);
  if (error) throw error;
}

/** Delete an event; if it was completed, return its ingredients to stock first.
 * The menu rows cascade-delete with the event. */
export async function deleteEvent(ev: EventRow, menu: MenuItemRow[]): Promise<void> {
  const sb = getSupabase();
  if (ev.status === 'done') {
    const guests = ev.guest_count || 1;
    for (const item of menu) {
      await applyRecipeStock(item.recipe_id, -(item.qty_per_person * guests));
    }
  }
  const { error } = await sb.from('events').delete().eq('id', ev.id);
  if (error) throw error;
}
