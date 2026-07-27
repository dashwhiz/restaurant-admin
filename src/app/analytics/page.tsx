'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader, EmptyState } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { fmtMKD } from '@/lib/format';
import { loadAnalytics, type AnalyticsData } from '@/lib/services/analytics';
import { TrendChart, RankChart } from './components/Charts';

const RANGES = [
  { days: 30, label: 'Последни 30 дена' },
  { days: 60, label: 'Последни 60 дена' },
  { days: 90, label: 'Последни 90 дена' },
  { days: 365, label: 'Последна година' },
];

// Rough industry rule of thumb: food cost above this is eating the margin.
const FOOD_COST_TARGET = 35;

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
  const toneClass = tone === 'good' ? 'text-success' : tone === 'bad' ? 'text-danger' : '';
  return (
    <div className="card">
      <p className="label">{label}</p>
      <p className={`text-2xl font-bold ${toneClass}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-muted">{sub}</p>}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <details className="card">
      <summary className="cursor-pointer text-sm font-bold uppercase tracking-wide text-muted">
        {title}
      </summary>
      <div className="mt-3">{children}</div>
    </details>
  );
}

function ValueTable({ rows, empty }: { rows: { category: string; value: number }[]; empty: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted">{empty}</p>;
  return (
    <table className="w-full text-sm">
      <tbody>
        {rows.map((r) => (
          <tr key={r.category} className="border-b border-border last:border-0">
            <td className="py-1.5 pr-2">{r.category}</td>
            <td className="py-1.5 text-right font-semibold">{fmtMKD(r.value)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default function AnalyticsPage() {
  const toast = useToast();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(
    async (d: number) => {
      setLoading(true);
      try {
        setData(await loadAnalytics(d));
      } catch (e) {
        toast('Грешка при вчитување: ' + (e as Error).message, 'error');
      } finally {
        setLoading(false);
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
        title="Аналитика"
        subtitle={`Преглед за последните ${days} дена`}
        actions={
          <select
            className="input w-auto"
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
          >
            {RANGES.map((r) => (
              <option key={r.days} value={r.days}>
                {r.label}
              </option>
            ))}
          </select>
        }
      />

      {loading && !data ? (
        <EmptyState text="Се вчитува…" />
      ) : !data || !k ? (
        <EmptyState text="Нема податоци за овој период." />
      ) : (
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Kpi
              label="Приход"
              value={fmtMKD(k.revenue)}
              sub={
                k.revenueFromPos > 0
                  ? `${fmtMKD(k.revenueFromPos)} од POS каса`
                  : `${k.unitsSold} продадени порции`
              }
            />
            <Kpi
              label="Кост на продадено"
              value={fmtMKD(k.cogs)}
              sub={`Food cost ${pct(k.foodCostPct)}`}
              tone={k.foodCostPct !== null && k.foodCostPct > FOOD_COST_TARGET ? 'bad' : undefined}
            />
            <Kpi
              label="Отпад"
              value={fmtMKD(k.wasteCost)}
              sub={`${pct(k.wastePctOfRevenue)} од приход · ${k.wasteCount} записи`}
              tone={k.wastePctOfRevenue !== null && k.wastePctOfRevenue > 5 ? 'bad' : undefined}
            />
            <Kpi
              label="Бруто маржа"
              value={pct(k.marginPct)}
              sub={`${fmtMKD(k.grossProfit)} профит`}
              tone={k.marginPct !== null && k.marginPct > 0 ? 'good' : 'bad'}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
                Приход по месец
              </h2>
              <TrendChart data={data.trend} />
            </div>
            <div className="card">
              <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">
                Топ 5 по приход
              </h2>
              {data.top.length === 0 ? (
                <p className="text-sm text-muted">Нема продажби во периодот.</p>
              ) : (
                <RankChart data={data.top.map((t) => ({ name: t.name, value: t.revenue }))} />
              )}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <div className="card">
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">
                ABC анализа
              </h2>
              <p className="mb-3 text-xs text-muted">
                A = рецептите што носат првите 70% од приходот, B до 90%, C останатото.
              </p>
              {data.abc.length === 0 ? (
                <p className="text-sm text-muted">Нема продажби во периодот.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {data.abc.map((r) => (
                        <tr key={r.id} className="border-b border-border last:border-0">
                          <td className="py-1.5 pr-2">
                            <Badge tone={r.klass === 'A' ? 'green' : r.klass === 'B' ? 'gray' : 'yellow'}>
                              {r.klass}
                            </Badge>
                          </td>
                          <td className="py-1.5 pr-2">{r.name}</td>
                          <td className="py-1.5 text-right font-semibold">{fmtMKD(r.revenue)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="card">
              <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">
                Денови залиха
              </h2>
              <p className="mb-3 text-xs text-muted">
                Според вистинската потрошувачка во периодот — што прво ќе снема.
              </p>
              {data.stockDays.length === 0 ? (
                <p className="text-sm text-muted">Нема доволно продажби за пресметка.</p>
              ) : (
                <div className="max-h-72 overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody>
                      {data.stockDays.slice(0, 15).map((r) => (
                        <tr key={r.id} className="border-b border-border last:border-0">
                          <td className="py-1.5 pr-2">{r.name}</td>
                          <td className="py-1.5 pr-2 text-right text-xs text-muted">
                            {r.currentStock.toFixed(1)} {r.unit}
                          </td>
                          <td
                            className={`py-1.5 text-right font-semibold ${
                              r.daysLeft !== null && r.daysLeft < 3 ? 'text-danger' : ''
                            }`}
                          >
                            {r.daysLeft === null ? '—' : `${Math.floor(r.daysLeft)} дена`}
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
              <p className="text-sm text-muted">Нема рецепти со пресметан кост.</p>
            ) : (
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border text-left text-xs text-muted">
                      <th className="py-1.5 font-semibold">Рецепт</th>
                      <th className="py-1.5 text-right font-semibold">Кост</th>
                      <th className="py-1.5 text-right font-semibold">Цена</th>
                      <th className="py-1.5 text-right font-semibold">Food cost</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.foodCost.map((r) => (
                      <tr key={r.id} className="border-b border-border last:border-0">
                        <td className="py-1.5 pr-2">{r.name}</td>
                        <td className="py-1.5 text-right">{fmtMKD(r.cost)}</td>
                        <td className="py-1.5 text-right">{fmtMKD(r.price)}</td>
                        <td
                          className={`py-1.5 text-right font-semibold ${
                            r.foodCostPct !== null && r.foodCostPct > FOOD_COST_TARGET
                              ? 'text-danger'
                              : ''
                          }`}
                        >
                          {pct(r.foodCostPct)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Section>

          <Section title={`Рецепти без ниту една продажба (${data.neverSold.length})`}>
            {data.neverSold.length === 0 ? (
              <p className="text-sm text-muted">Сите рецепти имаат продажби. Одлично.</p>
            ) : (
              <p className="text-sm">{data.neverSold.join(' · ')}</p>
            )}
          </Section>

          <Section title="Залиха — вредност по категорија">
            <ValueTable rows={data.inventoryByCategory} empty="Нема залиха." />
          </Section>

          <Section title="Отпад — по производ">
            <ValueTable rows={data.wasteByProduct} empty="Нема отпад во периодот." />
          </Section>

          <Section title="Испораки — по добавувач">
            <ValueTable rows={data.deliveriesBySupplier} empty="Нема испораки во периодот." />
          </Section>
        </div>
      )}
    </>
  );
}
