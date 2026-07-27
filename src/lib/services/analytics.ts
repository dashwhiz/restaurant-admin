// Analytics: one load, every number on the page derived from it.
//
// Two things here differ deliberately from the old HTML app:
//  1. COGS is the cost of what was SOLD (recipe ingredients × quantity), not the
//     money spent on deliveries in the period. Buying a big delivery late in the
//     month is not a drop in margin.
//  2. Every query pages (see paged.ts). The old app capped at 1000 rows and went
//     silently wrong on busy periods.
import { fetchAllRows } from './paged';
import type {
  Product,
  Purchase,
  Recipe,
  RecipeIngredient,
  Sale,
  WasteLog,
  PosImport,
  PosSalesItem,
} from '@/lib/types';

export interface Kpis {
  revenue: number;
  /** Which source the revenue came from, so the UI can be honest about it. */
  revenueFromPos: number;
  revenueFromPrices: number;
  cogs: number;
  wasteCost: number;
  grossProfit: number;
  marginPct: number | null;
  foodCostPct: number | null;
  wastePctOfRevenue: number | null;
  unitsSold: number;
  /** Portions sold whose recipe has no ingredient cost — they contribute 0 to
   *  COGS, so a high number means the margin above is flattering fiction. */
  uncostedUnits: number;
  deliveryCount: number;
  wasteCount: number;
}

export interface TrendPoint {
  month: string; // "јан"
  revenue: number;
}

export interface RecipeStat {
  id: string;
  name: string;
  qty: number;
  revenue: number;
}

export interface AbcRow extends RecipeStat {
  cumulativePct: number;
  klass: 'A' | 'B' | 'C';
}

export interface StockDayRow {
  id: string;
  name: string;
  unit: string;
  currentStock: number;
  dailyUse: number;
  daysLeft: number | null;
}

export interface FoodCostRow {
  id: string;
  name: string;
  cost: number;
  price: number;
  foodCostPct: number | null;
}

export interface CategoryValue {
  category: string;
  value: number;
}

export interface AnalyticsData {
  days: number;
  kpis: Kpis;
  trend: TrendPoint[];
  top: RecipeStat[];
  neverSold: string[];
  abc: AbcRow[];
  stockDays: StockDayRow[];
  foodCost: FoodCostRow[];
  inventoryByCategory: CategoryValue[];
  wasteByProduct: CategoryValue[];
  deliveriesBySupplier: CategoryValue[];
}

type SaleRow = Sale;
type WasteRow = WasteLog;

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString();
}

/** "2026-07" for the LOCAL month. toISOString() would give the UTC month, which
 *  is a different month either side of midnight — bars labelled with one month
 *  would then hold another month's takings. */
function localMonthKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Cost of one portion of a recipe, from its ingredients' current unit costs. */
function buildRecipeCosts(
  ingredients: RecipeIngredient[],
  productCost: Map<string, number>,
): Map<string, number> {
  const cost = new Map<string, number>();
  for (const ing of ingredients) {
    const unit = productCost.get(ing.product_id) ?? 0;
    cost.set(ing.recipe_id, (cost.get(ing.recipe_id) ?? 0) + ing.quantity * unit);
  }
  return cost;
}

export async function loadAnalytics(days: number): Promise<AnalyticsData> {
  const from = isoDaysAgo(days);
  // Trend always covers 6 months, independent of the selected period.
  const trendFrom = new Date();
  // setDate(1) first: on the 31st, shifting the month first overflows (Feb 31
  // becomes Mar 3) and the window silently loses a month.
  trendFrom.setDate(1);
  trendFrom.setMonth(trendFrom.getMonth() - 5);
  const trendFromIso = trendFrom.toISOString();
  const earliest = trendFromIso < from ? trendFromIso : from;

  const [products, recipes, ingredients, sales, purchases, waste, posImports] = await Promise.all([
    fetchAllRows<Product>('products'),
    fetchAllRows<Recipe>('recipes'),
    fetchAllRows<RecipeIngredient>('recipe_ingredients'),
    fetchAllRows<SaleRow>('sales', { gte: { column: 'created_at', value: earliest } }),
    fetchAllRows<Purchase>('purchases', { gte: { column: 'created_at', value: from } }),
    fetchAllRows<WasteRow>('waste_log', { gte: { column: 'created_at', value: from } }),
    // Bounded to the trend window — unbounded, this grows without limit and is
    // re-read in full on every range change.
    fetchAllRows<PosImport>('pos_imports', {
      gte: { column: 'import_date', value: earliest.slice(0, 10) },
    }),
  ]);
  // Only the line items belonging to those imports, and only the two columns
  // the totals need.
  const posItems =
    posImports.length === 0
      ? []
      : await fetchAllRows<Pick<PosSalesItem, 'import_id' | 'amount'>>('pos_sales_items', {
          select: 'id,import_id,amount',
          in: { column: 'import_id', values: posImports.map((i) => i.id) },
        });

  const productById = new Map(products.map((p) => [p.id, p]));
  const productCost = new Map(products.map((p) => [p.id, p.cost_per_unit ?? 0]));
  const recipeById = new Map(recipes.map((r) => [r.id, r]));
  const recipeCost = buildRecipeCosts(ingredients, productCost);

  const inPeriod = (iso: string) => iso >= from;
  const periodSales = sales.filter((s) => inPeriod(s.created_at));

  // ── Revenue: real till amounts where a POS import exists, prices elsewhere ──
  const importById = new Map(posImports.map((i) => [i.id, i]));
  const posDaysInPeriod = new Set(
    posImports.filter((i) => i.import_date >= from.slice(0, 10)).map((i) => i.import_date),
  );
  let revenueFromPos = 0;
  for (const item of posItems) {
    const imp = importById.get(item.import_id);
    if (imp && posDaysInPeriod.has(imp.import_date)) revenueFromPos += item.amount ?? 0;
  }
  let revenueFromPrices = 0;
  for (const s of periodSales) {
    if (posDaysInPeriod.has(s.created_at.slice(0, 10))) continue; // already counted at the till
    revenueFromPrices += s.quantity * (recipeById.get(s.recipe_id)?.selling_price ?? 0);
  }
  const revenue = revenueFromPos + revenueFromPrices;

  // ── COGS: what the sold portions cost to make ──
  const cogs = periodSales.reduce(
    (sum, s) => sum + s.quantity * (recipeCost.get(s.recipe_id) ?? 0),
    0,
  );
  const wasteCost = waste.reduce(
    (sum, w) => sum + w.quantity * (productCost.get(w.product_id) ?? 0),
    0,
  );
  const grossProfit = revenue - cogs - wasteCost;

  const kpis: Kpis = {
    revenue,
    revenueFromPos,
    revenueFromPrices,
    cogs,
    wasteCost,
    grossProfit,
    marginPct: revenue > 0 ? (grossProfit / revenue) * 100 : null,
    foodCostPct: revenue > 0 ? (cogs / revenue) * 100 : null,
    wastePctOfRevenue: revenue > 0 ? (wasteCost / revenue) * 100 : null,
    unitsSold: periodSales.reduce((s, x) => s + x.quantity, 0),
    uncostedUnits: periodSales.reduce(
      (s, x) => s + ((recipeCost.get(x.recipe_id) ?? 0) > 0 ? 0 : x.quantity),
      0,
    ),
    deliveryCount: purchases.length,
    wasteCount: waste.length,
  };

  // ── 6-month revenue trend ──
  const months: TrendPoint[] = [];
  const monthIndex = new Map<string, number>();
  for (let i = 5; i >= 0; i--) {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - i);
    monthIndex.set(localMonthKey(d), months.length);
    months.push({ month: d.toLocaleDateString('mk-MK', { month: 'short' }), revenue: 0 });
  }
  const posDayAll = new Set(posImports.map((i) => i.import_date));
  for (const item of posItems) {
    const imp = importById.get(item.import_id);
    const idx = imp ? monthIndex.get(imp.import_date.slice(0, 7)) : undefined;
    if (idx !== undefined) months[idx].revenue += item.amount ?? 0;
  }
  for (const s of sales) {
    if (posDayAll.has(s.created_at.slice(0, 10))) continue;
    const idx = monthIndex.get(localMonthKey(new Date(s.created_at)));
    if (idx !== undefined) {
      months[idx].revenue += s.quantity * (recipeById.get(s.recipe_id)?.selling_price ?? 0);
    }
  }

  // ── Per-recipe performance ──
  const stats = new Map<string, RecipeStat>();
  for (const s of periodSales) {
    const recipe = recipeById.get(s.recipe_id);
    if (!recipe) continue;
    const stat = stats.get(s.recipe_id) ?? { id: s.recipe_id, name: recipe.name, qty: 0, revenue: 0 };
    stat.qty += s.quantity;
    stat.revenue += s.quantity * (recipe.selling_price ?? 0);
    stats.set(s.recipe_id, stat);
  }
  // Name breaks revenue ties so classes don't shuffle between reloads.
  const ranked = [...stats.values()].sort(
    (a, b) => b.revenue - a.revenue || a.name.localeCompare(b.name),
  );
  const neverSold = recipes.filter((r) => !stats.has(r.id)).map((r) => r.name).sort();

  // ── ABC: A = recipes making the first 70% of revenue, B to 90%, C the rest ──
  const totalRanked = ranked.reduce((s, r) => s + r.revenue, 0);
  let running = 0;
  const abc: AbcRow[] = ranked.map((r) => {
    // Classify on the share BEFORE adding this item, so the top seller is always
    // A. Classifying after would make a lone recipe 100% cumulative — and "C".
    const before = totalRanked > 0 ? (running / totalRanked) * 100 : 0;
    running += r.revenue;
    const after = totalRanked > 0 ? (running / totalRanked) * 100 : 0;
    return { ...r, cumulativePct: after, klass: before < 70 ? 'A' : before < 90 ? 'B' : 'C' };
  });

  // ── Days of stock, from real consumption over the period ──
  const ingredientsByRecipe = new Map<string, RecipeIngredient[]>();
  for (const ing of ingredients) {
    const list = ingredientsByRecipe.get(ing.recipe_id) ?? [];
    list.push(ing);
    ingredientsByRecipe.set(ing.recipe_id, list);
  }
  const used = new Map<string, number>();
  for (const s of periodSales) {
    for (const ing of ingredientsByRecipe.get(s.recipe_id) ?? []) {
      used.set(ing.product_id, (used.get(ing.product_id) ?? 0) + ing.quantity * s.quantity);
    }
  }
  // Divide by the span the data actually covers, not the span requested. Asking
  // for a year when only 40 days of sales exist would otherwise make every
  // product look 9x better stocked than it is.
  const earliestSale = periodSales.reduce<string | null>(
    (min, s) => (min === null || s.created_at < min ? s.created_at : min),
    null,
  );
  const coveredDays = earliestSale
    ? Math.max(1, Math.min(days, (Date.now() - new Date(earliestSale).getTime()) / 86_400_000))
    : days;

  const stockDays: StockDayRow[] = products
    .map((p) => {
      const dailyUse = (used.get(p.id) ?? 0) / coveredDays;
      return {
        id: p.id,
        name: p.name,
        unit: p.unit,
        currentStock: p.current_stock,
        dailyUse,
        daysLeft: dailyUse > 0 ? p.current_stock / dailyUse : null,
      };
    })
    .filter((r) => r.dailyUse > 0)
    .sort((a, b) => (a.daysLeft ?? Infinity) - (b.daysLeft ?? Infinity));

  // ── Food cost per recipe ──
  const foodCost: FoodCostRow[] = recipes
    .map((r) => {
      const cost = recipeCost.get(r.id) ?? 0;
      const price = r.selling_price ?? 0;
      return { id: r.id, name: r.name, cost, price, foodCostPct: price > 0 ? (cost / price) * 100 : null };
    })
    // Keep zero-cost recipes visible — those are the ones missing a norm, and
    // they're exactly what drags COGS to nothing. Hiding them hides the problem.
    .filter((r) => r.cost > 0 || r.price > 0)
    .sort((a, b) => (b.foodCostPct ?? 0) - (a.foodCostPct ?? 0));

  // ── Detail roll-ups ──
  const sumBy = (rows: { key: string; value: number }[]): CategoryValue[] => {
    const map = new Map<string, number>();
    for (const r of rows) map.set(r.key, (map.get(r.key) ?? 0) + r.value);
    return [...map.entries()]
      .map(([category, value]) => ({ category, value }))
      .sort((a, b) => b.value - a.value);
  };

  const inventoryByCategory = sumBy(
    products.map((p) => ({ key: p.category || '—', value: p.current_stock * (p.cost_per_unit ?? 0) })),
  );
  const wasteByProduct = sumBy(
    waste.map((w) => ({
      key: productById.get(w.product_id)?.name ?? '—',
      value: w.quantity * (productCost.get(w.product_id) ?? 0),
    })),
  );
  const deliveriesBySupplier = sumBy(
    purchases.map((p) => ({ key: p.supplier || 'Без добавувач', value: p.quantity * (p.cost_per_unit ?? 0) })),
  );

  return {
    days,
    kpis,
    trend: months,
    top: ranked.slice(0, 5),
    neverSold,
    abc,
    stockDays,
    foodCost,
    inventoryByCategory,
    wasteByProduct,
    deliveriesBySupplier,
  };
}
