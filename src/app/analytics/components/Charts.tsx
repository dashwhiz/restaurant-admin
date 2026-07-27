'use client';

import {
  Bar,
  BarChart,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { fmtMKD } from '@/lib/format';

// Single-series charts throughout: magnitude is carried by bar length, so there
// is one hue and no legend (the card title names the series). Colours come from
// the theme tokens, so both light and dark follow the OS automatically.
const BAR = 'var(--color-primary)';
const AXIS = 'var(--color-muted)';

const axisTick = { fill: AXIS, fontSize: 11 };

function TooltipBox({
  active,
  payload,
  label,
  format,
}: {
  active?: boolean;
  payload?: { value?: number | string }[];
  label?: string | number;
  format: (n: number) => string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg border border-border bg-surface px-2 py-1 text-xs shadow-sm">
      <div className="font-semibold">{label}</div>
      <div className="text-muted">{format(Number(payload[0].value ?? 0))}</div>
    </div>
  );
}

/** Revenue over the last six months. */
export function TrendChart({ data }: { data: { month: string; revenue: number }[] }) {
  return (
    <ResponsiveContainer width="100%" height={180}>
      <BarChart data={data} margin={{ top: 4, right: 4, bottom: 0, left: 4 }}>
        <XAxis dataKey="month" tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis hide />
        <Tooltip
          cursor={{ fill: 'var(--color-border)', opacity: 0.3 }}
          content={<TooltipBox format={fmtMKD} />}
        />
        <Bar dataKey="revenue" fill={BAR} radius={[4, 4, 0, 0]} maxBarSize={48} />
      </BarChart>
    </ResponsiveContainer>
  );
}

/** Horizontal ranking: biggest at the top. */
export function RankChart({
  data,
  format = fmtMKD,
  height = 200,
}: {
  data: { name: string; value: number }[];
  format?: (n: number) => string;
  height?: number;
}) {
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart
        data={data}
        layout="vertical"
        margin={{ top: 0, right: 8, bottom: 0, left: 0 }}
        barCategoryGap={4}
      >
        <XAxis type="number" hide />
        <YAxis
          type="category"
          dataKey="name"
          tick={axisTick}
          tickLine={false}
          axisLine={false}
          width={110}
        />
        <Tooltip
          cursor={{ fill: 'var(--color-border)', opacity: 0.3 }}
          content={<TooltipBox format={format} />}
        />
        <Bar dataKey="value" fill={BAR} radius={[0, 4, 4, 0]} maxBarSize={18}>
          {data.map((d) => (
            <Cell key={d.name} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
