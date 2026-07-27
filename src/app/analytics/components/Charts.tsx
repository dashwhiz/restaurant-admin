'use client';

import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { fmtMKD } from '@/lib/format';

// Single-series charts: magnitude is carried by bar length, so there is one hue
// and no legend (the card title names the series).
//
// These use the RAW tokens (--primary, not --color-primary). Tailwind v4 only
// emits a --color-* variable when that literal string appears in a scanned file,
// so --color-danger and friends simply don't exist at runtime — a chart using
// one would render colourless, and only in a production build. The raw tokens
// are declared unconditionally in globals.css and flip with the OS just the same.
const BAR = 'var(--primary)';
const AXIS = 'var(--muted)';

const axisTick = { fill: AXIS, fontSize: 11 };

function truncate(name: string, max = 16): string {
  return name.length > max ? `${name.slice(0, max - 1)}…` : name;
}

function TooltipBox({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: { value?: number | string }[];
  label?: string | number;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-2 py-1 text-xs">
      <div className="font-semibold">{label}</div>
      <div className="text-muted">{fmtMKD(Number(payload[0].value ?? 0))}</div>
    </div>
  );
}

/** Revenue over the last six months. */
export function TrendChart({ data }: { data: { month: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart
        data={data}
        margin={{ top: 16, right: 4, bottom: 0, left: 4 }}
        title="Приход по месец"
        desc="Приход по месец за последните шест месеци"
      >
        <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis hide />
        <Tooltip cursor={{ fill: 'var(--border)', opacity: 0.3 }} content={<TooltipBox />} />
        <Bar dataKey="revenue" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={48} isAnimationActive={false}>
          {/* The number belongs on the chart, not only in a tooltip nobody finds
              on a phone. */}
          <LabelList
            dataKey="revenue"
            position="top"
            formatter={(v) => (Number(v) > 0 ? fmtMKD(Number(v)) : '')}
            style={{ fill: AXIS, fontSize: 10 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal ranking: biggest at the top. */
export function RankChart({ data }: { data: { id: string; name: string; value: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 56, bottom: 0, left: 0 }}
        barCategoryGap={4}
        title="Топ 5 по приход"
        desc="Петте рецепти со најголем приход во периодот"
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={104}
          // Long names run off the left edge and are cut with no ellipsis.
          tickFormatter={(n: string) => truncate(n)}
        />
        <Tooltip cursor={{ fill: 'var(--border)', opacity: 0.3 }} content={<TooltipBox />} />
        <Bar dataKey="value" fill={BAR} radius={[0, 4, 4, 0]} maxBarSize={18} isAnimationActive={false}>
          <LabelList
            dataKey="value"
            position="right"
            formatter={(v) => fmtMKD(Number(v))}
            style={{ fill: AXIS, fontSize: 10 }}
          />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
