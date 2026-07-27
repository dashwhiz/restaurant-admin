'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { fmtMKD, fmtTime } from '@/lib/format';
import { loadAnalytics, type AnalyticsData } from '@/lib/services/analytics';
import { TrendChart, RankChart } from './components/Charts';

const RANGES = [
  { days: 30, label: 'Последни 30 дена' },
  { days: 60, label: 'Последни 60 дена' },
  { days: 90, label: 'Последни 90 дена' },
  { days: 365, label: 'Последна година' },
];

// Rough industry rules of thumb.
const FOOD_COST_TARGET = 35; // above this, food cost is eating the margin
const WASTE_TARGET_PCT = 5; // above this, waste is a problem not a rounding error

// A = carries the revenue, B = the middle, C = the tail. The letter is still the
// real signal — the colour just makes the three groups scannable at a glance.
const ABC_TONE = { A: 'green', B: 'yellow', C: 'red' } as const;
const ABC_TEXT = {
  A: 'text-success',
  B: 'text-yellow-600 dark:text-yellow-500',
  C: 'text-danger',
} as const;

// This page pulls eight tables in full, so it's the one place where refetching
// on every visit is worth avoiding. Cached per range; the refresh button forces
// a reload, and the TTL stops a tab left open overnight showing yesterday.
const CACHE_TTL_MS = 5 * 60 * 1000;
const cache = new Map<number, { data: AnalyticsData; at: number }>();

function pct(n: number | null): string {
  return n === null ? '—' : `${n.toFixed(1)}%`;
}

function Kpi({
  label,
  value,
  sub,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  tone?: 'good' | 'bad';
}) {
  const toneClass =
    tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-danger' : '';
  return (
    <div className='card'>
      <p className='label'>{label}</p>
      <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
      {sub && <p className='mt-0.5 text-xs text-muted'>{sub}</p>}
    </div>
  );
}

// Everything on this page is visible at once — it's an analytics page, so hiding
// numbers behind a click is friction with no payoff.
function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div className='card'>
      <h2 className='text-sm font-bold uppercase tracking-wide text-muted'>
        {title}
      </h2>
      <div className='mt-3'>{children}</div>
    </div>
  );
}

function ValueTable({
  rows,
  empty,
}: {
  rows: { category: string; value: number }[];
  empty: string;
}) {
  if (rows.length === 0) return <p className='text-sm text-muted'>{empty}</p>;
  return (
    // max-h-72 matches the ABC and Денови залиха cards above, so the row reads
    // as one band instead of two cards of different heights.
    <div className='max-h-72 overflow-x-auto overflow-y-auto'>
      <table className='w-full text-sm'>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.category}
              className='border-b border-border last:border-0'
            >
              <td className='py-1.5 pr-2'>{r.category}</td>
              <td className='py-1.5 text-right font-semibold whitespace-nowrap'>
                {fmtMKD(r.value)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function AnalyticsPage() {
  const toast = useToast();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchedAt, setFetchedAt] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Only the newest request may write state — otherwise flipping the range
  // quickly can let a slow answer land last and label it with the wrong period.
  const latestRequest = useRef(0);

  const load = useCallback(
    async (d: number, force = false) => {
      const hit = cache.get(d);
      if (!force && hit && Date.now() - hit.at < CACHE_TTL_MS) {
        setData(hit.data);
        setFetchedAt(hit.at);
        setLoading(false);
        return;
      }
      const token = ++latestRequest.current;
      setError(null);
      setLoading(true);
      try {
        const result = await loadAnalytics(d);
        if (token !== latestRequest.current) return;
        const at = Date.now();
        cache.set(d, { data: result, at });
        setData(result);
        setFetchedAt(at);
      } catch (e) {
        if (token === latestRequest.current) {
          // Keep the failure on screen. A vanishing toast plus an empty state
          // reads as "you sold nothing", which is a lie the owner may act on.
          setError((e as Error).message);
          toast('Грешка при вчитување: ' + (e as Error).message, 'error');
        }
      } finally {
        if (token === latestRequest.current) setLoading(false);
      }
    },
    [toast],
  );

  useEffect(() => {
    load(days);
  }, [days, load]);

  const k = data?.kpis;

  return (
    <>
      <PageHeader
        title='Аналитика'
        subtitle={
          fetchedAt
            ? `Преглед за последните ${days} дена · освежено ${fmtTime(new Date(fetchedAt).toISOString())}`
            : `Преглед за последните ${days} дена`
        }
        actions={
          <>
            <select
              className='select w-auto'
              aria-label='Период'
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
            >
              {RANGES.map((r) => (
                <option key={r.days} value={r.days}>
                  {r.label}
                </option>
              ))}
            </select>
            <button
              className='btn-ghost'
              onClick={() => load(days, true)}
              disabled={loading}
            >
              {loading ? 'Освежува…' : 'Освежи'}
            </button>
          </>
        }
      />

      {error ? (
        <div className='card border-danger/40'>
          <p className='text-sm font-semibold text-danger'>
            Податоците не се вчитаа.
          </p>
          <p className='mt-1 text-xs text-muted'>{error}</p>
          <button className='btn-ghost mt-3' onClick={() => load(days, true)}>
            Обиди се повторно
          </button>
        </div>
      ) : loading && !data ? (
        <EmptyState text='Се вчитува…' />
      ) : !data || !k ? (
        <EmptyState text='Нема податоци за овој период.' />
      ) : (
        <div className={`grid gap-4 ${loading ? 'opacity-60' : ''}`}>
          <div className='grid gap-4 sm:grid-cols-2 lg:grid-cols-4'>
            <Kpi
              label='Приход'
              value={fmtMKD(k.revenue)}
              sub={
                k.revenueFromPos > 0
                  ? `${fmtMKD(k.revenueFromPos)} од POS каса`
                  : `${k.unitsSold} продадени порции`
              }
            />
            <Kpi
              label='Кост на продадено'
              value={fmtMKD(k.cogs)}
              sub={`Food cost ${pct(k.foodCostPct)}`}
              tone={
                k.foodCostPct !== null && k.foodCostPct > FOOD_COST_TARGET
                  ? 'bad'
                  : undefined
              }
            />
            <Kpi
              label='Отпад'
              value={fmtMKD(k.wasteCost)}
              sub={`${pct(k.wastePctOfRevenue)} од приход · ${k.wasteCount} записи`}
              tone={
                k.wastePctOfRevenue !== null &&
                k.wastePctOfRevenue > WASTE_TARGET_PCT
                  ? 'bad'
                  : undefined
              }
            />
            <Kpi
              label='Бруто маржа'
              value={pct(k.marginPct)}
              sub={
                k.uncostedUnits > 0
                  ? `⚠ ${k.uncostedUnits} порции без норматив — маржата е превисока`
                  : `${fmtMKD(k.grossProfit)} профит`
              }
              tone={
                k.uncostedUnits > 0
                  ? 'bad'
                  : k.marginPct !== null && k.marginPct >= 55
                    ? 'good'
                    : undefined
              }
            />
          </div>

          <div className='grid gap-4 lg:grid-cols-2'>
            <div className='card'>
              <h2 className='mb-3 text-sm font-bold uppercase tracking-wide text-muted'>
                Приход по месец
              </h2>
              <TrendChart data={data.trend} />
            </div>
            <div className='card'>
              <h2 className='mb-3 text-sm font-bold uppercase tracking-wide text-muted'>
                Топ 5 по приход
              </h2>
              {data.top.length === 0 ? (
                <p className='text-sm text-muted'>Нема продажби во периодот.</p>
              ) : (
                <RankChart
                  data={data.top.map((t) => ({
                    id: t.id,
                    name: t.name,
                    value: t.revenue,
                  }))}
                />
              )}
            </div>
          </div>

          <div className='grid gap-4 lg:grid-cols-2'>
            <div className='card'>
              <h2 className='mb-1 text-sm font-bold uppercase tracking-wide text-muted'>
                ABC анализа
              </h2>
              <p className='mb-3 text-xs text-muted'>
                <span className={`font-bold ${ABC_TEXT.A}`}>A</span> = рецептите
                што носат првите 70% од приходот,{' '}
                <span className={`font-bold ${ABC_TEXT.B}`}>B</span> до 90%,{' '}
                <span className={`font-bold ${ABC_TEXT.C}`}>C</span> останатото.
              </p>
              {data.abc.length === 0 ? (
                <p className='text-sm text-muted'>Нема продажби во периодот.</p>
              ) : (
                <div className='max-h-72 overflow-y-auto'>
                  <table className='w-full text-sm'>
                    <tbody>
                      {data.abc.map((r) => (
                        <tr
                          key={r.id}
                          className='border-b border-border last:border-0'
                        >
                          <td className='py-1.5 pr-2'>
                            <Badge tone={ABC_TONE[r.klass]}>{r.klass}</Badge>
                          </td>
                          <td className={`py-1.5 pr-2 ${ABC_TEXT[r.klass]}`}>
                            {r.name}
                          </td>
                          <td
                            className={`py-1.5 text-right font-semibold ${ABC_TEXT[r.klass]}`}
                          >
                            {fmtMKD(r.revenue)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className='card'>
              <h2 className='mb-1 text-sm font-bold uppercase tracking-wide text-muted'>
                Денови залиха
              </h2>
              <p className='mb-3 text-xs text-muted'>
                Според вистинската потрошувачка во периодот — што прво ќе снема.
              </p>
              {data.stockDays.length === 0 ? (
                <p className='text-sm text-muted'>
                  Нема доволно продажби за пресметка.
                </p>
              ) : (
                <div className='max-h-72 overflow-y-auto'>
                  <table className='w-full text-sm'>
                    <tbody>
                      {data.stockDays.slice(0, 15).map((r) => (
                        <tr
                          key={r.id}
                          className='border-b border-border last:border-0'
                        >
                          <td className='py-1.5 pr-2'>{r.name}</td>
                          <td className='py-1.5 pr-2 text-right text-xs text-muted'>
                            {r.currentStock.toFixed(1)} {r.unit}
                          </td>
                          <td
                            className={`py-1.5 text-right font-semibold ${
                              r.daysLeft !== null && r.daysLeft < 3
                                ? 'text-danger'
                                : ''
                            }`}
                          >
                            {r.daysLeft === null
                              ? '—'
                              : r.daysLeft <= 0
                                ? 'нема'
                                : `${Math.floor(r.daysLeft)} дена`}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <Section title={`Food cost по рецепт (${data.foodCost.length})`}>
            {data.foodCost.length === 0 ? (
              <p className='text-sm text-muted'>
                Нема рецепти со пресметан кост.
              </p>
            ) : (
              <div className='max-h-96 overflow-y-auto'>
                <table className='w-full text-sm'>
                  <thead>
                    <tr className='border-b border-border text-left text-xs text-muted'>
                      <th className='py-1.5 font-semibold'>Рецепт</th>
                      <th className='py-1.5 text-right font-semibold'>Кост</th>
                      <th className='py-1.5 text-right font-semibold'>Цена</th>
                      <th className='py-1.5 text-right font-semibold'>
                        Food cost
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.foodCost.map((r) => (
                      <tr
                        key={r.id}
                        className='border-b border-border last:border-0'
                      >
                        <td className='py-1.5 pr-2'>{r.name}</td>
                        <td className='py-1.5 text-right'>{fmtMKD(r.cost)}</td>
                        <td className='py-1.5 text-right'>{fmtMKD(r.price)}</td>
                        <td className='py-1.5 text-right font-semibold whitespace-nowrap'>
                          {r.cost === 0 ? (
                            <Badge tone='yellow'>нема норматив</Badge>
                          ) : r.foodCostPct !== null &&
                            r.foodCostPct > FOOD_COST_TARGET ? (
                            <span className='text-danger'>
                              {pct(r.foodCostPct)}{' '}
                              <Badge tone='red'>висок</Badge>
                            </span>
                          ) : (
                            pct(r.foodCostPct)
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <div className='grid gap-4 lg:grid-cols-2'>
            <Section
              title={`Рецепти без продажба во периодот (${data.neverSold.length})`}
            >
              {data.neverSold.length === 0 ? (
                <p className='text-sm text-muted'>
                  Сите рецепти имаат продажби. Одлично.
                </p>
              ) : (
                <ul className='max-h-72 divide-y divide-border overflow-y-auto text-sm'>
                  {data.neverSold.map((r) => (
                    <li key={r.id} className='py-1.5'>
                      {r.name}
                    </li>
                  ))}
                </ul>
              )}
            </Section>

            <Section title='Залиха — вредност по категорија'>
              <ValueTable
                rows={data.inventoryByCategory}
                empty='Нема залиха.'
              />
            </Section>
          </div>

          <Section title='Отпад — по производ'>
            <ValueTable
              rows={data.wasteByProduct}
              empty='Нема отпад во периодот.'
            />
          </Section>

          <Section title='Испораки — по добавувач'>
            <ValueTable
              rows={data.deliveriesBySupplier}
              empty='Нема испораки во периодот.'
            />
          </Section>
        </div>
      )}
    </>
  );
}
