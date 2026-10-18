// Product history: every record that changed one product's stock, merged into
// a single timeline. Read-only — it never touches stock.
//
// Sales and events don't store per-product amounts, only "N × recipe", so their
// effect is worked out from the recipe as it is TODAY. If a recipe changed
// since, old lines show the new amounts.
import { fetchAllRows } from './paged';
import { fmtMKD } from '@/lib/format';

export type HistoryKind = 'delivery' | 'sale' | 'waste' | 'stocktake' | 'event' | 'reset';

export interface HistoryEntry {
  id: string;
  kind: HistoryKind;
  at: string;
  /** Signed change to this product's stock (+ in, − out). */
  qty: number;
  text: string;
}

const round = (n: number) => Number(n.toFixed(3));

/** All history for one product, newest first. `since` (ISO) limits by date. */
export async function productHistory(productId: string, since: string | null): Promise<HistoryEntry[]> {
  const gte = since ? { column: 'created_at', value: since } : undefined;
  const mine = { column: 'product_id', values: [productId] };

  // Which recipes use this product, and how much per portion. The same product
  // can appear twice in one recipe, so amounts are summed per recipe.
  const ingredients = await fetchAllRows<{ recipe_id: string; quantity: number; recipe: { name: string } | null }>(
    'recipe_ingredients',
    { select: 'recipe_id, quantity, recipe:recipes(name)', in: mine },
  );
  const perPortion = new Map<string, number>();
  const recipeName = new Map<string, string>();
  for (const ing of ingredients) {
    perPortion.set(ing.recipe_id, (perPortion.get(ing.recipe_id) ?? 0) + (Number(ing.quantity) || 0));
    recipeName.set(ing.recipe_id, ing.recipe?.name ?? '?');
  }
  const recipeIds = [...perPortion.keys()];

  const [deliveries, waste, counts, resets, sales, menuItems] = await Promise.all([
    fetchAllRows<{ id: string; quantity: number; cost_per_unit: number; supplier: string | null; created_at: string }>(
      'purchases',
      { select: 'id, quantity, cost_per_unit, supplier, created_at', in: mine, gte },
    ),
    fetchAllRows<{ id: string; quantity: number; reason: string | null; created_at: string }>('waste_log', {
      select: 'id, quantity, reason, created_at',
      in: mine,
      gte,
    }),
    fetchAllRows<{ id: string; system_qty: number; counted_qty: number; difference: number; created_at: string }>(
      'stocktake_log',
      { select: 'id, system_qty, counted_qty, difference, created_at', in: mine, gte },
    ),
    fetchAllRows<{ id: string; previous_qty: number; new_qty: number; reason: string; created_at: string }>(
      'stock_adjustments',
      { select: 'id, previous_qty, new_qty, reason, created_at', in: mine, gte },
    ),
    recipeIds.length
      ? fetchAllRows<{ id: string; recipe_id: string; quantity: number; notes: string | null; created_at: string }>(
          'sales',
          { select: 'id, recipe_id, quantity, notes, created_at', in: { column: 'recipe_id', values: recipeIds }, gte },
        )
      : Promise.resolve([]),
    // Events are few; filtered by date and status below rather than in the query.
    recipeIds.length
      ? fetchAllRows<{
          recipe_id: string;
          qty_per_person: number;
          event: { id: string; name: string; event_date: string | null; guest_count: number; status: string; created_at: string } | null;
        }>('event_menu_items', {
          select: 'recipe_id, qty_per_person, event:events(id, name, event_date, guest_count, status, created_at)',
          in: { column: 'recipe_id', values: recipeIds },
        })
      : Promise.resolve([]),
  ]);

  const entries: HistoryEntry[] = [];

  for (const d of deliveries) {
    const cost = Number(d.cost_per_unit) > 0 ? ` · ${fmtMKD(d.cost_per_unit)}/ед. без ДДВ` : '';
    entries.push({
      id: `delivery-${d.id}`,
      kind: 'delivery',
      at: d.created_at,
      qty: Number(d.quantity) || 0,
      text: `${d.supplier || 'Без добавувач'}${cost}`,
    });
  }

  for (const w of waste) {
    entries.push({
      id: `waste-${w.id}`,
      kind: 'waste',
      at: w.created_at,
      qty: -(Number(w.quantity) || 0),
      text: w.reason || 'Без причина',
    });
  }

  for (const c of counts) {
    entries.push({
      id: `stocktake-${c.id}`,
      kind: 'stocktake',
      at: c.created_at,
      qty: Number(c.difference) || 0,
      text: `Систем ${round(Number(c.system_qty) || 0)} → избројано ${round(Number(c.counted_qty) || 0)}`,
    });
  }

  for (const r of resets) {
    entries.push({
      id: `reset-${r.id}`,
      kind: 'reset',
      at: r.created_at,
      qty: (Number(r.new_qty) || 0) - (Number(r.previous_qty) || 0),
      text: `${r.reason || 'Рачна промена'} (било ${round(Number(r.previous_qty) || 0)})`,
    });
  }

  for (const s of sales) {
    const used = (perPortion.get(s.recipe_id) ?? 0) * (Number(s.quantity) || 0);
    if (!used) continue;
    const note = s.notes ? ` · ${s.notes}` : '';
    entries.push({
      id: `sale-${s.id}`,
      kind: 'sale',
      at: s.created_at,
      qty: -used,
      text: `${s.quantity} × ${recipeName.get(s.recipe_id)}${note}`,
    });
  }

  // One line per completed event, summing every menu item that uses the product.
  const events = new Map<string, HistoryEntry>();
  for (const m of menuItems) {
    const ev = m.event;
    if (!ev || ev.status !== 'done') continue;
    const at = ev.event_date || ev.created_at;
    if (since && at < since.slice(0, at.length)) continue;
    const guests = ev.guest_count || 1;
    const used = (perPortion.get(m.recipe_id) ?? 0) * (Number(m.qty_per_person) || 0) * guests;
    const entry = events.get(ev.id) ?? { id: `event-${ev.id}`, kind: 'event' as const, at, qty: 0, text: `${ev.name} · ${guests} гости` };
    entry.qty -= used;
    events.set(ev.id, entry);
  }
  entries.push(...[...events.values()].filter((e) => e.qty !== 0));

  return entries.map((e) => ({ ...e, qty: round(e.qty) })).sort((a, b) => b.at.localeCompare(a.at));
}
