'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { fmtDate } from '@/lib/format';
import { productHistory, type HistoryEntry, type HistoryKind } from '@/lib/services/history';
import type { Product } from '@/lib/types';

const KINDS: { key: HistoryKind; label: string; tone: 'green' | 'blue' | 'red' | 'purple' | 'yellow' | 'gray' }[] = [
  { key: 'delivery', label: 'Поставка', tone: 'green' },
  { key: 'sale', label: 'Продажба', tone: 'blue' },
  { key: 'waste', label: 'Отпад', tone: 'red' },
  { key: 'stocktake', label: 'Попис', tone: 'purple' },
  { key: 'event', label: 'Настан', tone: 'yellow' },
  { key: 'reset', label: 'Нулирање', tone: 'gray' },
];

const PERIODS = [
  { days: 7, label: 'Последни 7 дена' },
  { days: 30, label: 'Последни 30 дена' },
  { days: 90, label: 'Последни 90 дена' },
  { days: 0, label: 'Сè' },
];

const signed = (n: number) => (n > 0 ? '+' : '') + Number(n.toFixed(3));

/** Everything that changed one product's stock, newest first. Read-only. */
export function ProductHistory({ product, onClose }: { product: Product | null; onClose: () => void }) {
  const toast = useToast();
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [days, setDays] = useState(30);
  const [kind, setKind] = useState<HistoryKind | 'all'>('all');

  useEffect(() => {
    if (!product) return;
    let stale = false;
    setLoading(true);
    const since = days ? new Date(Date.now() - days * 86_400_000).toISOString() : null;
    productHistory(product.id, since)
      .then((rows) => !stale && setEntries(rows))
      .catch((e) => toast('Грешка при вчитување: ' + (e as Error).message, 'error'))
      .finally(() => !stale && setLoading(false));
    return () => {
      stale = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product, days]);

  // Reset the filters for the next product opened.
  function close() {
    setKind('all');
    setDays(30);
    setEntries([]);
    onClose();
  }

  const totals = useMemo(() => {
    const t = new Map<HistoryKind, number>();
    for (const e of entries) t.set(e.kind, (t.get(e.kind) ?? 0) + e.qty);
    return t;
  }, [entries]);

  const shown = kind === 'all' ? entries : entries.filter((e) => e.kind === kind);

  if (!product) return null;
  const unit = product.unit;

  return (
    <Modal open onClose={close} title={`Историја — ${product.name}`}>
      <p className="mb-4 text-sm text-muted">
        Залиха сега: <span className="font-semibold text-foreground">{product.current_stock} {unit}</span>
        {product.min_stock > 0 && <> · Минимум: {product.min_stock} {unit}</>}
      </p>

      <div className="mb-3 flex flex-wrap items-center gap-1">
        <button
          className={kind === 'all' ? 'btn-ghost border-primary px-2 py-1 text-primary' : 'btn-ghost px-2 py-1'}
          onClick={() => setKind('all')}
        >
          Сите
        </button>
        {KINDS.map((k) => (
          <button
            key={k.key}
            className={kind === k.key ? 'btn-ghost border-primary px-2 py-1 text-primary' : 'btn-ghost px-2 py-1'}
            onClick={() => setKind(k.key)}
          >
            {k.label}
          </button>
        ))}
      </div>

      <select
        className="select mb-3 w-auto"
        aria-label="Период"
        value={days}
        onChange={(e) => setDays(Number(e.target.value))}
      >
        {PERIODS.map((p) => (
          <option key={p.days} value={p.days}>{p.label}</option>
        ))}
      </select>

      {totals.size > 0 && (
        <p className="mb-3 text-xs text-muted">
          {KINDS.filter((k) => totals.has(k.key))
            .map((k) => `${k.label} ${signed(totals.get(k.key) as number)} ${unit}`)
            .join(' · ')}
        </p>
      )}

      {loading ? (
        <p className="py-6 text-center text-sm text-muted">Вчитување…</p>
      ) : shown.length === 0 ? (
        <p className="py-6 text-center text-sm text-muted">Нема записи за овој период</p>
      ) : (
        <ul className="divide-y divide-border/60 text-sm">
          {shown.map((e) => {
            const k = KINDS.find((x) => x.key === e.kind)!;
            return (
              <li key={e.id} className="flex items-start gap-3 py-2">
                <span className="w-20 shrink-0 text-muted">{fmtDate(e.at)}</span>
                <div className="min-w-0 flex-1">
                  <Badge tone={k.tone}>{k.label}</Badge>
                  <p className="mt-0.5 break-words">{e.text}</p>
                </div>
                <span className={`shrink-0 font-semibold ${e.qty < 0 ? 'text-danger' : e.qty > 0 ? 'text-success' : 'text-muted'}`}>
                  {signed(e.qty)} {unit}
                </span>
              </li>
            );
          })}
        </ul>
      )}

      <p className="mt-4 text-xs text-muted">
        Продажбите и настаните се пресметани според рецептот каков што е денес.
      </p>
    </Modal>
  );
}
