// Catering events. Completing an event deducts its menu's ingredients from
// stock; deleting a completed event returns them. All via the stock helper.
import { getSupabase } from '@/lib/supabase';
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
