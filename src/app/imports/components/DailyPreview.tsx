'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { IconSearch } from '@/components/ui/Icons';
import { fmtMKD, fmtDate } from '@/lib/format';
import { listRecipes } from '@/lib/services/recipes';
import { createEvent } from '@/lib/services/events';
import { getMappings, saveMappings, importDaily, type DailySaleInput, type MappingInput } from '@/lib/services/imports';
import { bestMatch, isSpecialOrder } from '@/lib/pos/match';
import type { ParsedDaily } from '@/lib/pos/parse';
import type { Recipe } from '@/lib/types';
import { RecipePicker, SKIP } from './RecipePicker';



export function DailyPreview({ parsed, onDone }: { parsed: ParsedDaily; onDone: () => void }) {
  const toast = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [resolutions, setResolutions] = useState<Record<string, string>>({}); // sifra -> recipeId | SKIP | ''
  const [deduct, setDeduct] = useState(true);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [recs, maps] = await Promise.all([listRecipes(), getMappings()]);
        setRecipes(recs);
        const mapBySifra = new Map(maps.map((m) => [m.sifra, m]));
        // Initial resolution per item: remembered mapping → fuzzy match → empty.
        const init: Record<string, string> = {};
        for (const it of parsed.items) {
          const mapped = mapBySifra.get(it.sifra);
          if (mapped) init[it.sifra] = mapped.skip ? SKIP : mapped.recipe_id ?? '';
          else init[it.sifra] = bestMatch(it.name, recs)?.item.id ?? '';
        }
        setResolutions(init);
      } catch (e) {
        toast('Грешка: ' + (e as Error).message, 'error');
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const specials = useMemo(() => parsed.items.filter((i) => isSpecialOrder(i.name)), [parsed.items]);
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? parsed.items.filter((i) => i.name.toLowerCase().includes(q)) : parsed.items;
  }, [parsed.items, query]);

  const matchedCount = parsed.items.filter((i) => {
    const r = resolutions[i.sifra];
    return r && r !== SKIP;
  }).length;

  async function confirm() {
    setBusy(true);
    try {
      // Remember every resolution (one batched write) so the same šifra
      // auto-matches next time. Undecided rows ('') are not saved.
      const entries: MappingInput[] = parsed.items
        .filter((it) => resolutions[it.sifra])
        .map((it) => {
          const r = resolutions[it.sifra];
          return r === SKIP
            ? { sifra: it.sifra, recipe_id: null, skip: true }
            : { sifra: it.sifra, recipe_id: r, skip: false };
        });
      await saveMappings(entries);
      const items: DailySaleInput[] = parsed.items
        .filter((i) => resolutions[i.sifra] && resolutions[i.sifra] !== SKIP)
        .map((i) => ({ recipeId: resolutions[i.sifra], qty: i.qty }));
      const n = await importDaily(parsed.date, items, deduct);
      toast(`Увезени ${n} продажби за ${fmtDate(parsed.date)}`, 'success');
      onDone();
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function makeEvents() {
    try {
      let created = 0;
      for (const it of specials) {
        await createEvent({
          name: it.name,
          type: 'Специјална нарачка',
          event_date: parsed.date,
          guest_count: Math.max(1, Math.round(it.qty)),
          price_per_person: it.qty > 0 ? Number((it.amount / it.qty).toFixed(2)) : 0,
          notes: `Од POS увоз (${parsed.date}) · вкупно ${fmtMKD(it.amount)}`,
        });
        created++;
      }
      toast(`Создадени ${created} настани. Дополни ги во Настани.`, 'success');
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    }
  }

  if (loading) return <p className="text-sm text-muted">Вчитување…</p>;

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-3">
        <Badge tone="blue">{fmtDate(parsed.date)}</Badge>
        <span className="text-sm text-muted">{parsed.items.length} ставки · {matchedCount} совпаднати</span>
        <label className="ml-auto flex items-center gap-2 text-sm">
          <input type="checkbox" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} />
          Одземи од залиха
        </label>
      </div>

      {specials.length > 0 && (
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-purple-500/40 bg-purple-500/10 px-4 py-3 text-sm">
          <span>{specials.length} специјална нарачка пронајдена.</span>
          <button className="btn-ghost" onClick={makeEvents}>Префрли во Настани</button>
        </div>
      )}

      <div className="mb-3 flex items-center gap-2 rounded-lg border border-border bg-surface px-3">
        <IconSearch className="h-4 w-4 text-muted" />
        <input className="w-full bg-transparent py-2 text-sm outline-none" placeholder="Пребарувај ставка…" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>

      <div className="card max-h-[55vh] overflow-y-auto p-0">
        {shown.length === 0 ? (
          <EmptyState text="Нема ставки" />
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 border-b border-border bg-surface text-left text-xs uppercase text-muted">
              <tr>
                <th className="p-2">Ставка</th>
                <th className="p-2 text-right">Кол.</th>
                <th className="p-2">Рецепт</th>
              </tr>
            </thead>
            <tbody>
              {shown.map((it) => {
                const val = resolutions[it.sifra] ?? '';
                const ok = val && val !== SKIP;
                return (
                  <tr key={it.sifra} className="border-b border-border/60 last:border-0">
                    <td className="p-2">
                      <span className="font-medium">{it.name}</span>
                      {isSpecialOrder(it.name) && <Badge tone="purple">Настан</Badge>}
                    </td>
                    <td className="p-2 text-right">{it.qty}</td>
                    <td className="p-2">
                      <RecipePicker
                        value={val}
                        recipes={recipes}
                        invalid={!ok}
                        onChange={(next) => setResolutions((r) => ({ ...r, [it.sifra]: next }))}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onDone}>Откажи</button>
        <button className="btn-primary" onClick={confirm} disabled={busy}>
          {busy ? 'Увезување…' : 'Увези продажби'}
        </button>
      </div>
    </div>
  );
}
