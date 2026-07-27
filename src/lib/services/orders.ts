// Листа за нарачка — what to buy. Products at or below their minimum, grouped
// by whoever supplied them last. Same rules as the old app.
import { getSupabase } from '@/lib/supabase';
import { listProducts } from './products';
import { departmentOf } from '@/lib/format';
import type { Product } from '@/lib/types';

export const NO_SUPPLIER = 'Без добавувач';

export interface OrderItem extends Product {
  supplier: string;
  /** How much to buy: enough to reach twice the minimum. */
  suggested: number;
  department_label: 'Бар' | 'Кујна';
}

export interface OrderList {
  items: OrderItem[];
  bySupplier: { supplier: string; items: OrderItem[] }[];
  barCount: number;
  kitchenCount: number;
  supplierCount: number;
}

export async function loadOrderList(): Promise<OrderList> {
  const products = await listProducts();
  // min_stock of 0 means "don't track this one" — it never appears here.
  const low = products.filter((p) => p.min_stock > 0 && p.current_stock <= p.min_stock);

  if (low.length === 0) {
    return { items: [], bySupplier: [], barCount: 0, kitchenCount: 0, supplierCount: 0 };
  }

  // Newest purchase first, so the first row seen per product is its last supplier.
  const { data, error } = await getSupabase()
    .from('purchases')
    .select('product_id, supplier, created_at')
    .in('product_id', low.map((p) => p.id))
    .order('created_at', { ascending: false });
  if (error) throw error;

  const lastSupplier = new Map<string, string>();
  for (const row of (data ?? []) as { product_id: string; supplier: string | null }[]) {
    if (!lastSupplier.has(row.product_id)) {
      lastSupplier.set(row.product_id, row.supplier || NO_SUPPLIER);
    }
  }

  const items: OrderItem[] = low.map((p) => ({
    ...p,
    supplier: lastSupplier.get(p.id) ?? NO_SUPPLIER,
    // Negative stock (allowed on purpose) correctly asks for more.
    suggested: Math.max(Number((2 * p.min_stock - p.current_stock).toFixed(3)), p.min_stock),
    department_label: departmentOf(p.department || p.category),
  }));

  const grouped = new Map<string, OrderItem[]>();
  for (const item of items) {
    const list = grouped.get(item.supplier) ?? [];
    list.push(item);
    grouped.set(item.supplier, list);
  }

  return {
    items,
    bySupplier: [...grouped.entries()]
      .map(([supplier, list]) => ({
        supplier,
        items: list.sort((a, b) => a.name.localeCompare(b.name)),
      }))
      .sort((a, b) => a.supplier.localeCompare(b.supplier)),
    barCount: items.filter((i) => i.department_label === 'Бар').length,
    kitchenCount: items.filter((i) => i.department_label === 'Кујна').length,
    supplierCount: grouped.size,
  };
}

/** Plain text for pasting into a message to the supplier. */
export function orderListAsText(list: OrderList): string {
  return list.bySupplier
    .map(({ supplier, items }) =>
      [
        `${supplier}:`,
        ...items.map((i) => `  ${i.name} — ${i.suggested} ${i.unit}`),
      ].join('\n'),
    )
    .join('\n\n');
}
