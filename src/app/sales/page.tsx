'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { IconPlus, IconEdit, IconTrash, IconChevron } from '@/components/ui/Icons';
import { fmtMKD, fmtDate, departmentOf } from '@/lib/format';
import { exportCsv, downloadCsv, toCsv } from '@/lib/csv';
import { listRecipes } from '@/lib/services/recipes';
import { listSales, deleteSale, type SaleRow } from '@/lib/services/sales';
import { eventAmount, listDatedEvents } from '@/lib/services/events';
import type { EventRow, Recipe } from '@/lib/types';
import { eventVatRate, recipeVatRate } from '@/lib/vat';
import { useVat } from '@/components/layout/Vat';
import { SaleDialog } from './components/SaleDialog';

interface DayGroup {
  day: string;
  bar: SaleRow[];
  kitchen: SaleRow[];
  /** Events of the day (special orders, catering…), counted in its takings. */
  events: EventRow[];
  revenue: number;
  count: number;
}

// Department accents so Бар / Кујна read apart at a glance (theme-aware).
const BAR_TONE = { border: 'border-blue-500', text: 'text-blue-600 dark:text-blue-400' };
const KITCHEN_TONE = { border: 'border-amber-500', text: 'text-amber-600 dark:text-amber-400' };
const EVENT_TONE = { border: 'border-purple-500', text: 'text-purple-600 dark:text-purple-400' };

export default function SalesPage() {
  const toast = useToast();
  const vat = useVat();
  const [sales, setSales] = useState<SaleRow[]>([]);
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [eventRows, setEventRows] = useState<EventRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [openDays, setOpenDays] = useState<Set<string>>(new Set());
  const [dialog, setDialog] = useState<{ open: boolean; row: SaleRow | null }>({ open: false, row: null });

  async function load() {
    setLoading(true);
    try {
      const [s, r, sp] = await Promise.all([listSales(), listRecipes(), listDatedEvents()]);
      setSales(s);
      setRecipes(r);
      setEventRows(sp);
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

  // One row per sale, with the columns the owner actually reads in Excel —
  // not the raw table (no uuids, prices resolved).
  function rowsFor(list: SaleRow[], events: EventRow[]) {
    return [
      ...list.map((s) => ({
        датум: (s.created_at || '').slice(0, 10),
        рецепт: s.recipe?.name ?? '',
        оддел: departmentOf(s.recipe?.category),
        количина: s.quantity ?? 0,
        цена: s.recipe?.selling_price ?? 0,
        износ: s.is_gratis ? 0 : (s.quantity || 0) * (s.recipe?.selling_price ?? 0),
        белешка: s.notes ?? '',
      })),
      ...events.map((e) => ({
        датум: e.event_date ?? '',
        рецепт: e.name,
        оддел: 'Настан',
        количина: e.guest_count,
        цена: Number(e.price_per_person) || 0,
        износ: eventAmount(e),
        белешка: e.notes ?? '',
      })),
    ];
  }

  function exportAll() {
    const n = exportCsv('prodazbi', rowsFor(sales, eventRows));
    toast(n > 0 ? `Преземени ${n} продажби` : 'Нема што да се преземе', n > 0 ? 'success' : 'error');
  }

  function exportDay(day: string, list: SaleRow[], events: EventRow[]) {
    downloadCsv(`lira-prodazbi-${day}.csv`, toCsv(rowsFor(list, events)));
    toast(`Преземени продажби за ${fmtDate(day)}`, 'success');
  }

  // Group by day (newest first), split each day into Бар / Кујна.
  const groups = useMemo<DayGroup[]>(() => {
    const byDay = new Map<string, DayGroup>();
    const dayGroup = (day: string) => {
      if (!byDay.has(day)) byDay.set(day, { day, bar: [], kitchen: [], events: [], revenue: 0, count: 0 });
      return byDay.get(day)!;
    };
    for (const s of sales) {
      const g = dayGroup((s.created_at || '').slice(0, 10));
      (departmentOf(s.recipe?.category) === 'Бар' ? g.bar : g.kitchen).push(s);
      g.revenue += s.recipe && !s.is_gratis ? vat.price((s.quantity || 0) * (s.recipe.selling_price ?? 0), recipeVatRate(s.recipe)) : 0;
      g.count += 1;
    }
    for (const e of eventRows) {
      const g = dayGroup(e.event_date!);
      g.events.push(e);
      g.revenue += vat.price(eventAmount(e), eventVatRate(e.type));
      g.count += 1;
    }
    // Newest first; a day with only an event lands in its place too.
    return [...byDay.values()].sort((a, b) => b.day.localeCompare(a.day));
  }, [sales, eventRows, vat]);

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

  const row = (s: SaleRow) => {
    // The daily import stamps "POS <date>" — redundant here since the day is in
    // the header. Hide it, but keep any real note a manual sale carries.
    const note = s.notes && !/^POS \d{4}-\d{2}-\d{2}( · гратис)?$/.test(s.notes) ? s.notes : null;
    return (
    <div key={s.id} className="flex items-center gap-2 border-b border-border/60 py-2 text-sm last:border-0">
      <div className="min-w-0 flex-1">
        <span className="font-semibold">{s.recipe?.name ?? '?'}</span>
        {s.is_gratis && <> <Badge tone="yellow">Гратис</Badge></>}
        {note && <span className="text-muted"> · {note}</span>}
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
  };

  const section = (label: string, list: SaleRow[], tone: { border: string; text: string }) =>
    list.length === 0 ? null : (
      <div className={`mt-3 border-l-4 ${tone.border} pl-3`}>
        <div className={`mb-1 text-xs font-bold uppercase tracking-wide ${tone.text}`}>
          {label} · {list.reduce((n, s) => n + (s.quantity || 0), 0)}×
        </div>
        {list.map(row)}
      </div>
    );

  // Read-only here: guests, price and menu are edited in Настани.
  const eventSection = (list: EventRow[]) =>
    list.length === 0 ? null : (
      <div className={`mt-3 border-l-4 ${EVENT_TONE.border} pl-3`}>
        <div className={`mb-1 text-xs font-bold uppercase tracking-wide ${EVENT_TONE.text}`}>
          Настани · {list.length}
        </div>
        {list.map((e) => (
          <div key={e.id} className="flex items-center gap-2 border-b border-border/60 py-2 text-sm last:border-0">
            <div className="min-w-0 flex-1">
              <Link href="/events" className="font-semibold hover:text-primary hover:underline" title="Измени во Настани">
                {e.name}
              </Link>{' '}
              <Badge tone={e.status === 'done' ? 'green' : 'purple'}>{e.status === 'done' ? 'Завршен' : 'Планиран'}</Badge>
              <span className="text-muted"> · {e.guest_count} × {fmtMKD(vat.price(Number(e.price_per_person) || 0, eventVatRate(e.type)))}</span>
            </div>
            <span className="whitespace-nowrap font-medium">{fmtMKD(vat.price(eventAmount(e), eventVatRate(e.type)))}</span>
          </div>
        ))}
      </div>
    );

  return (
    <>
      <PageHeader
        title="Продажби"
        subtitle="По денови, поделено на Бар и Кујна"
        actions={
          <>
            <button className="btn-ghost" onClick={exportAll} disabled={sales.length === 0}>
              CSV
            </button>
            <button className="btn-primary" onClick={() => setDialog({ open: true, row: null })}>
              <IconPlus className="h-4 w-4" /> Нова продажба
            </button>
          </>
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
                {/* Siblings, not nested — a button inside a button is invalid
                    and the inner one stops working. */}
                <div className="flex w-full items-center bg-surface pr-2">
                  <button
                    onClick={() => toggle(g.day)}
                    className="flex flex-1 items-center gap-3 px-4 py-3 text-left"
                  >
                    <IconChevron className={`h-4 w-4 shrink-0 transition-transform ${open ? 'rotate-90' : ''}`} />
                    <span className="flex-1 font-bold">{fmtDate(g.day)}</span>
                    <span className="text-xs text-muted">{g.count} ставки</span>
                    {g.revenue > 0 && <span className="font-bold">{fmtMKD(g.revenue)}</span>}
                  </button>
                  <button
                    className="btn-ghost shrink-0 px-2 py-1 text-xs"
                    title={`Преземи CSV за ${fmtDate(g.day)}`}
                    onClick={() => exportDay(g.day, [...g.bar, ...g.kitchen], g.events)}
                  >
                    CSV
                  </button>
                </div>
                {open && (
                  <div className="border-t border-border bg-surface px-4 pb-3">
                    {section('Бар', g.bar, BAR_TONE)}
                    {section('Кујна', g.kitchen, KITCHEN_TONE)}
                    {eventSection(g.events)}
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
