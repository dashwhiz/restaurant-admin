'use client';

import { useEffect, useMemo, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { IconPlus, IconEdit, IconTrash, IconChevron } from '@/components/ui/Icons';
import { fmtMKD, fmtDate, departmentOf } from '@/lib/format';
import { listRecipes } from '@/lib/services/recipes';
import { listSales, deleteSale, type SaleRow } from '@/lib/services/sales';
import type { Recipe } from '@/lib/types';
import { SaleDialog } from './components/SaleDialog';

interface DayGroup {
  day: string;
  bar: SaleRow[];
  kitchen: SaleRow[];
  revenue: number;
  count: number;
}

export default function SalesPage() {
  const toast = useToast();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ open: boolean; row: SaleRow | null }>({ open: false, row: null });

  async function load() {
    setLoading(true);
    try {
      const [s, r] = await Promise.all([listSales(), listRecipes()]);
      setSales(s);
      setRecipes(r);
      if (s.length) setOpenDays(new Set([(s[0].created_at || '').slice(0, 10)])); // newest day open
    } catch (e) {
      toast('Грешка при вчитување: ' + (e as Error).message, 'error');
    } finally {
      setLoading(false);
    }
  }
  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Group by day (newest first), split each day into Бар / Кујна.
  const groups = useMemo<DayGroup[]>(() => {
    const byDay = new Map<string, DayGroup>();
    for (const s of sales) {
      const day = (s.created_at || '').slice(0, 10);
      if (!byDay.has(day)) byDay.set(day, { day, bar: [], kitchen: [], revenue: 0, count: 0 });
      const g = byDay.get(day)!;
      (departmentOf(s.recipe?.category) === 'Бар' ? g.bar : g.kitchen).push(s);
      g.revenue += (s.quantity || 0) * (s.recipe?.selling_price ?? 0);
      g.count += 1;
    }
    return [...byDay.values()];
  }, [sales]);

  function toggle(day: string) {
    setOpenDays((prev) => {
      const next = new Set(prev);
      next.has(day) ? next.delete(day) : next.add(day);
      return next;
    });
  }

  async function remove(s: SaleRow) {
    if (!confirm('Избриши ја оваа продажба? Состојките ќе се вратат во залиха.')) return;
    try {
      await deleteSale(s.id);
      toast('Избришано', 'success');
      load();
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    }
  }

  const row = (s: SaleRow) => (
    <div key={s.id} className="flex items-center gap-2 border-b border-border/60 py-2 text-sm last:border-0">
      <div className="min-w-0 flex-1">
        <span className="font-semibold">{s.recipe?.name ?? '?'}</span>
        {s.notes && <span className="text-muted"> · {s.notes}</span>}
      </div>
      <span className="whitespace-nowrap font-medium">{s.quantity}×</span>
      <button className="btn-ghost px-2 py-1" onClick={() => setDialog({ open: true, row: s })} aria-label="Измени">
        <IconEdit className="h-4 w-4" />
      </button>
      <button className="btn-ghost px-2 py-1 text-danger" onClick={() => remove(s)} aria-label="Избриши">
        <IconTrash className="h-4 w-4" />
      </button>
    </div>
  );

  const section = (label: string, list: SaleRow[]) =>
    list.length === 0 ? null : (
      <div className="mt-2">
        <div className="mb-1 text-xs font-bold uppercase tracking-wide text-muted">
          {label} · {list.reduce((n, s) => n + (s.quantity || 0), 0)}×
        </div>
        {list.map(row)}
      </div>
    );

  return (
    <>
      <PageHeader
        title="Продажби"
        subtitle="По денови, поделено на Бар и Кујна"
        actions={
          <button className="btn-primary" onClick={() => setDialog({ open: true, row: null })}>
            <IconPlus className="h-4 w-4" /> Нова продажба
          </button>
        }
      />

      {loading ? (
        <p className="text-sm text-muted">Вчитување…</p>
      ) : groups.length === 0 ? (
        <div className="card"><EmptyState text="Сè уште нема продажби" /></div>
      ) : (
        <div className="flex flex-col gap-3">
          {groups.map((g) => {
            const open = openDays.has(g.day);
            return (
              <div key={g.day} className="overflow-hidden rounded-xl border border-border">
                <button
                  onClick={() => toggle(g.day)}
                  className="flex w-full items-center gap-3 bg-surface px-4 py-3 text-left"
                >
                  <IconChevron className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                  <span className="flex-1 font-bold">{fmtDate(g.day)}</span>
                  <span className="text-xs text-muted">{g.count} ставки</span>
                  {g.revenue > 0 && <span className="font-bold">{fmtMKD(g.revenue)}</span>}
                </button>
                {open && (
                  <div className="border-t border-border bg-surface px-4 pb-3">
                    {section('Бар', g.bar)}
                    {section('Кујна', g.kitchen)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <SaleDialog
        open={dialog.open}
        sale={dialog.row}
        recipes={recipes}
        onClose={() => setDialog({ open: false, row: null })}
        onSaved={load}
      />
    </>
  );
}
