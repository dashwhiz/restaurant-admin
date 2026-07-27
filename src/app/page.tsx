'use client';

import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { IconCheck } from '@/components/ui/Icons';
import { useToast } from '@/components/ui/Toast';
import { fmtMKD } from '@/lib/format';
import { listProducts } from '@/lib/services/products';
import { listRecipes } from '@/lib/services/recipes';
import { recentActivity, timeAgo, type ActivityEntry } from '@/lib/services/activity';
import type { Product } from '@/lib/types';

export default function DashboardPage() {
  const toast = useToast();
  const [products, setProducts] = useState<Product[]>([]);
  const [recipeCount, setRecipeCount] = useState(0);
  const [activity, setActivity] = useState<ActivityEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const [p, r, a] = await Promise.all([listProducts(), listRecipes(), recentActivity()]);
        setProducts(p);
        setRecipeCount(r.length);
        setActivity(a);
      } catch (e) {
        toast('Грешка при вчитување: ' + (e as Error).message, 'error');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const low = products.filter((p) => p.min_stock > 0 && p.current_stock <= p.min_stock);
  const value = products.reduce((s, p) => s + p.current_stock * p.cost_per_unit, 0);

  return (
    <>
      <PageHeader title="Контролна табла" subtitle="Преглед на состојбата" />

      {loading ? (
        <p className="text-sm text-muted">Вчитување…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Производи" value={String(products.length)} />
            <Stat label="Рецепти" value={String(recipeCount)} />
            <Stat label="Мала залиха" value={String(low.length)} tone={low.length ? 'warning' : undefined} />
            <Stat label="Вредност на залиха" value={fmtMKD(value)} />
          </div>

          <div className="card mt-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Мала залиха</h2>
            {low.length === 0 ? (
              <p className="flex items-center gap-2 text-sm text-muted">
                <IconCheck className="h-4 w-4 text-success" /> Сите ставки се над минимумот.
              </p>
            ) : (
              <ul className="divide-y divide-border">
                {low.map((p) => (
                  <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                    <span className="font-medium">{p.name}</span>
                    <span className="flex items-center gap-2">
                      <Badge tone={p.current_stock <= 0 ? 'red' : 'yellow'}>
                        {p.current_stock <= 0 ? 'Нема' : 'Малку'}
                      </Badge>
                      <span className="text-muted">
                        {p.current_stock} / {p.min_stock} {p.unit}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="card mt-5">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
              Последни активности
            </h2>
            {activity.length === 0 ? (
              <p className="text-sm text-muted">Сè уште нема активности.</p>
            ) : (
              <ul className="divide-y divide-border">
                {activity.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 py-2 text-sm">
                    <span className="flex min-w-0 items-center gap-2">
                      <Badge
                        tone={a.kind === 'sale' ? 'green' : a.kind === 'delivery' ? 'blue' : 'red'}
                      >
                        {a.kind === 'sale' ? 'Продажба' : a.kind === 'delivery' ? 'Испорака' : 'Отпад'}
                      </Badge>
                      <span className="truncate">{a.text}</span>
                    </span>
                    <span className="shrink-0 text-muted">{timeAgo(a.at)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </>
  );
}

function Stat({ label, value, tone }: { label: string; value: string; tone?: 'warning' }) {
  return (
    <div className="card">
      <div className={`text-2xl font-extrabold ${tone === 'warning' ? 'text-warning' : ''}`}>{value}</div>
      <div className="mt-0.5 text-xs text-muted">{label}</div>
    </div>
  );
}
