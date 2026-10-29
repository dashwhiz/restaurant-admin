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

/**
 * An open bar's payment ("Спец.нарачка-шанк"). The drinks themselves are rung
 * on a separate table and given out as GRATIS, so their stock and cost already
 * come in with the sales. This event is only the money: no menu, finished from
 * the start, 18% like drinks.
 */
export const OPEN_BAR_TYPE = 'Open bar';
const isBarOrder = (name: string) => /шанк|šank|sank/i.test(name);

/**
 * Events as takings: special orders are paid at the till and the owner renames
 * them and changes their type (→ Прослава), so every dated event counts —
 * guests × price per guest on its day, completed or not. The event, not a
 * sale, is the one record: its stock moves when it's completed, and fixing
 * guests/price there fixes the turnover too.
 */
export async function listDatedEvents(): Promise<EventRow[]> {
  const { data, error } = await getSupabase()
    .from('events')
    .select('*')
    .not('event_date', 'is', null);
  if (error) throw error;
  return (data ?? []) as EventRow[];
}

/** What a special order brought in, with VAT (as the till shows it). */
export const eventAmount = (e: Pick<EventRow, 'guest_count' | 'price_per_person'>) =>
  (Number(e.guest_count) || 0) * (Number(e.price_per_person) || 0);

export interface PosSpecial {
  date: string;
  name: string;
  qty: number;
  amount: number;
}

/**
 * Turn POS "special order" lines into events (menu left empty, to be filled
 * in Настани); a шанк line becomes a finished Open bar event (see above). A
 * line whose event already exists — same name and date, any type — is skipped,
 * so re-importing a day or clicking twice makes no duplicates. Returns how many
 * were created and how many already existed.
 */
export async function createEventsFromPos(specials: PosSpecial[]): Promise<{ created: number; existing: number }> {
  if (specials.length === 0) return { created: 0, existing: 0 };
  const dates = [...new Set(specials.map((s) => s.date))];
  const { data, error } = await getSupabase()
    .from('events')
    .select('name, event_date')
    .in('event_date', dates);
  if (error) throw error;
  const key = (name: string, date: string | null) => `${date}|${name}`;
  const seen = new Set((data ?? []).map((e) => key(e.name, e.event_date)));

  const rows: (EventInput & { status?: string; completed_at?: string })[] = [];
  for (const s of specials) {
    const k = key(s.name, s.date);
    if (seen.has(k)) continue;
    seen.add(k);
    const bar = isBarOrder(s.name);
    rows.push({
      name: s.name,
      type: bar ? OPEN_BAR_TYPE : SPECIAL_ORDER_TYPE,
      event_date: s.date,
      // The till's quantity isn't the number of guests — the owner enters
      // guests and the price per guest himself. Until then it's 1 × the total.
      guest_count: 1,
      price_per_person: s.amount,
      notes: bar
        ? `Од POS увоз (${s.date}) · open bar, пијалокот е во гратис`
        : `Од POS увоз (${s.date}) · ${s.qty} × на касата, вкупно ${fmtMKD(s.amount)} · внеси гости рачно`,
      ...(bar ? { status: 'done', completed_at: new Date().toISOString() } : {}),
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
  // Mark it done first, and only if it isn't already, so a second click (or a
  // stale page) can't deduct the menu again. completed_at is when stock moved,
  // for normativ corrections (see normativ.ts).
  const { data, error } = await sb
    .from('events')
    .update({ status: 'done', completed_at: new Date().toISOString() })
    .eq('id', ev.id)
    .neq('status', 'done')
    .select('id');
  if (error) throw error;
  if (!data?.length) throw new Error('Настанот е веќе завршен — освежете ја страницата.');
  const guests = ev.guest_count || 1;
  for (const item of menu) {
    await applyRecipeStock(item.recipe_id, item.qty_per_person * guests);
  }
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
