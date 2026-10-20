// What a normativ change does to stock that was already deducted.
//
// A sale deducts its recipe's ingredients as they are AT THE TIME. If the
// normativ changes later, those past deductions are wrong for the new recipe —
// and deleting such a sale would reverse the NEW amounts, not what was actually
// taken. (Плескавица moved from Кртина to Мелено Месо after two days of sales:
// Мелено Месо never went down, both Кртина went to −4.24.) This works out the
// difference so the caller can show it and apply it.
//
// Only portions that took stock after each product's stock was last set outright
// (a stocktake, "Нулирај залиха", a hand edit) count: that value already held
// the real amount, so re-correcting earlier sales would undo it. "After" means
// when stock actually moved — `sales.inserted_at`, `events.completed_at`,
// `stocktake_log.inserted_at` — not the business day a row is dated: yesterday's
// POS file imported after this morning's count still deducted after it.
// See docs/features/stock.md.
import { fetchAllRows } from './paged';
import { applyLoggedStockDeltas } from './stock';
import { CONTROL_REASON } from './stocktake';

/** Prefix of the stock_adjustments rows written here. History reads it. */
export const NORMATIV_REASON = 'Норматив сменет: ';

export interface IngredientAmount {
  product_id: string;
  quantity: number;
}

export interface NormativStockChange {
  productId: string;
  name: string;
  unit: string;
  /** Signed change to stock (+ gives back, − takes more). */
  delta: number;
  /** Portions of the changed recipes this product's correction covers. */
  portions: number;
}

const EPS = 1e-9;

// Long `in (...)` lists go in the URL; 100 uuids keeps it well under limits.
async function inChunks<T>(ids: string[], fetch: (slice: string[]) => Promise<T[]>): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += 100) out.push(...(await fetch(ids.slice(i, i + 100))));
  return out;
}

const sumByProduct = (items: IngredientAmount[]) => {
  const m = new Map<string, number>();
  for (const i of items) m.set(i.product_id, (m.get(i.product_id) ?? 0) + (Number(i.quantity) || 0));
  return m;
};

/**
 * Stock corrections for replacing the normativ of each recipe in `next`
 * (recipe id → its new ingredients). Read-only: nothing is written. Call it
 * BEFORE saving the new ingredients — it reads the current ones as "old".
 */
export async function planNormativStock(next: Map<string, IngredientAmount[]>): Promise<NormativStockChange[]> {
  const recipeIds = [...next.keys()];
  if (recipeIds.length === 0) return [];

  const oldRows = await inChunks(recipeIds, (slice) =>
    fetchAllRows<IngredientAmount & { recipe_id: string }>('recipe_ingredients', {
      select: 'recipe_id, product_id, quantity',
      in: { column: 'recipe_id', values: slice },
    }),
  );
  const oldByRecipe = new Map<string, IngredientAmount[]>();
  for (const r of oldRows) oldByRecipe.set(r.recipe_id, [...(oldByRecipe.get(r.recipe_id) ?? []), r]);

  // Per recipe: how much more (+) or less (−) of each product one portion uses now.
  const perPortion = new Map<string, Map<string, number>>();
  for (const id of recipeIds) {
    const before = sumByProduct(oldByRecipe.get(id) ?? []);
    const after = sumByProduct(next.get(id) ?? []);
    const diff = new Map<string, number>();
    for (const pid of new Set([...before.keys(), ...after.keys()])) {
      const d = (after.get(pid) ?? 0) - (before.get(pid) ?? 0);
      if (Math.abs(d) > EPS) diff.set(pid, d);
    }
    if (diff.size) perPortion.set(id, diff);
  }
  const changed = [...perPortion.keys()];
  if (changed.length === 0) return [];
  const productIds = [...new Set(changed.flatMap((id) => [...perPortion.get(id)!.keys()]))];

  const [sales, menuItems, counts, resets, products] = await Promise.all([
    inChunks(changed, (slice) =>
      fetchAllRows<{ recipe_id: string; quantity: number; inserted_at: string; stock_deducted: boolean }>('sales', {
        select: 'recipe_id, quantity, inserted_at, stock_deducted',
        in: { column: 'recipe_id', values: slice },
      }),
    ),
    inChunks(changed, (slice) =>
      fetchAllRows<{
        recipe_id: string;
        qty_per_person: number;
        event: { completed_at: string | null; guest_count: number; status: string; created_at: string } | null;
      }>('event_menu_items', {
        select: 'recipe_id, qty_per_person, event:events(completed_at, guest_count, status, created_at)',
        in: { column: 'recipe_id', values: slice },
      }),
    ),
    inChunks(productIds, (slice) =>
      fetchAllRows<{ product_id: string; inserted_at: string }>('stocktake_log', {
        select: 'product_id, inserted_at',
        in: { column: 'product_id', values: slice },
      }),
    ),
    inChunks(productIds, (slice) =>
      fetchAllRows<{ product_id: string; reason: string; created_at: string }>('stock_adjustments', {
        select: 'product_id, reason, created_at',
        in: { column: 'product_id', values: slice },
      }),
    ),
    inChunks(productIds, (slice) =>
      fetchAllRows<{ id: string; name: string; unit: string }>('products', {
        select: 'id, name, unit',
        in: { column: 'id', values: slice },
      }),
    ),
  ]);

  // The latest moment each product's stock was set outright. Normativ
  // corrections and control corrections are just deltas on top of sales and
  // don't reset it.
  const cutoff = new Map<string, number>();
  const bump = (pid: string, at: string) => cutoff.set(pid, Math.max(cutoff.get(pid) ?? -Infinity, Date.parse(at)));
  for (const c of counts) bump(c.product_id, c.inserted_at);
  for (const r of resets) {
    const reason = r.reason || '';
    if (!reason.startsWith(NORMATIV_REASON) && reason !== CONTROL_REASON) bump(r.product_id, r.created_at);
  }

  // Every portion that took stock: sales (paid and gratis) and completed events.
  // A POS day imported without "Одземи од залиха" never took any, so it's skipped.
  const portions: { recipeId: string; qty: number; at: number }[] = [];
  for (const s of sales) {
    if (s.stock_deducted === false) continue;
    portions.push({ recipeId: s.recipe_id, qty: Number(s.quantity) || 0, at: Date.parse(s.inserted_at) });
  }
  for (const m of menuItems) {
    const ev = m.event;
    if (!ev || ev.status !== 'done') continue;
    const at = Date.parse(ev.completed_at ?? ev.created_at);
    portions.push({ recipeId: m.recipe_id, qty: (Number(m.qty_per_person) || 0) * (ev.guest_count || 1), at });
  }

  const delta = new Map<string, number>();
  const covered = new Map<string, number>();
  for (const p of portions) {
    for (const [pid, d] of perPortion.get(p.recipeId) ?? []) {
      if (p.at <= (cutoff.get(pid) ?? -Infinity)) continue;
      delta.set(pid, (delta.get(pid) ?? 0) - d * p.qty);
      covered.set(pid, (covered.get(pid) ?? 0) + p.qty);
    }
  }

  const byId = new Map(products.map((p) => [p.id, p]));
  // Not rounded: a later sale delete reverses the exact new amount, so the
  // correction has to be exact too. The screen rounds when it shows it.
  return [...delta.entries()]
    .filter(([, d]) => Math.abs(d) > EPS)
    .map(([pid, d]) => ({
      productId: pid,
      name: byId.get(pid)?.name ?? '?',
      unit: byId.get(pid)?.unit ?? '',
      delta: d,
      portions: Number((covered.get(pid) ?? 0).toFixed(3)),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Apply a plan from `planNormativStock`, logged so Историја shows it. */
export async function applyNormativStock(changes: NormativStockChange[], what: string): Promise<void> {
  await applyLoggedStockDeltas(
    changes.map((c) => ({ productId: c.productId, delta: c.delta })),
    NORMATIV_REASON + what,
  );
}
