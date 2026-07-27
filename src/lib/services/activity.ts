// Последни активности for the dashboard: the newest sales, deliveries and waste
// merged into one list, exactly as the old app showed them.
import { getSupabase } from '@/lib/supabase';

export type ActivityKind = 'sale' | 'delivery' | 'waste';

export interface ActivityEntry {
  id: string;
  kind: ActivityKind;
  text: string;
  at: string;
}

const PER_TABLE = 8;

export async function recentActivity(limit = 8): Promise<ActivityEntry[]> {
  const sb = getSupabase();
  // Each table is capped before merging — we only ever show the newest few.
  const [sales, deliveries, waste] = await Promise.all([
    sb
      .from('sales')
      .select('id, quantity, created_at, recipe:recipes(name)')
      .order('created_at', { ascending: false })
      .limit(PER_TABLE),
    sb
      .from('purchases')
      .select('id, quantity, created_at, product:products(name)')
      .order('created_at', { ascending: false })
      .limit(PER_TABLE),
    sb
      .from('waste_log')
      .select('id, quantity, created_at, product:products(name)')
      .order('created_at', { ascending: false })
      .limit(PER_TABLE),
  ]);

  type Joined = {
    id: string;
    quantity: number;
    created_at: string;
    recipe?: { name?: string } | null;
    product?: { name?: string } | null;
  };

  const entries: ActivityEntry[] = [
    ...((sales.data ?? []) as unknown as Joined[]).map((s) => ({
      id: `sale-${s.id}`,
      kind: 'sale' as const,
      text: `Продадено ${s.quantity} × ${s.recipe?.name ?? '?'}`,
      at: s.created_at,
    })),
    ...((deliveries.data ?? []) as unknown as Joined[]).map((d) => ({
      id: `delivery-${d.id}`,
      kind: 'delivery' as const,
      text: `Примено ${d.quantity} × ${d.product?.name ?? '?'}`,
      at: d.created_at,
    })),
    ...((waste.data ?? []) as unknown as Joined[]).map((w) => ({
      id: `waste-${w.id}`,
      kind: 'waste' as const,
      text: `Отпад: ${w.quantity} × ${w.product?.name ?? '?'}`,
      at: w.created_at,
    })),
  ];

  return entries.sort((a, b) => b.at.localeCompare(a.at)).slice(0, limit);
}

/** "пред 5 мин" — the old app's timeAgo. */
export function timeAgo(iso: string): string {
  const seconds = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
  if (seconds < 60) return 'сега';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `пред ${minutes} мин`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `пред ${hours} ч`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `пред ${days} д`;
  return new Date(iso).toLocaleDateString('mk-MK', { day: '2-digit', month: '2-digit', year: 'numeric' });
}
