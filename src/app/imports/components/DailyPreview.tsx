'use client';

import { useEffect, useMemo, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { EmptyState } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { IconSearch } from '@/components/ui/Icons';
import { fmtDate } from '@/lib/format';
import { listRecipes, recipesWithIngredients } from '@/lib/services/recipes';
import { getMappings, saveMappings, importDaily, getImportedDays, type DailySaleInput, type MappingInput } from '@/lib/services/imports';
import { bestMatch, isSpecialOrder } from '@/lib/pos/match';
import type { ParsedDaily } from '@/lib/pos/parse';
import type { Recipe } from '@/lib/types';
import { RecipePicker, SKIP } from './RecipePicker';
import { ImportWarning } from './ImportWarning';
import { SpecialOrders, importSpecials } from './SpecialOrders';



export function DailyPreview({ parsed, onDone }: { parsed: ParsedDaily; onDone: () => void }) {
  const toast = useToast();
  const [recipes, setRecipes] = useState<Recipe[]>([]);
  const [withIngredients, setWithIngredients] = useState<Set<string>>(new Set());
  const [resolutions, setResolutions] = useState<Record<string, string>>({}); // sifra -> recipeId | SKIP | ''
  const [deduct, setDeduct] = useState(true);
  // Importing a day twice doubles its sales and deducts its stock again.
  const [alreadyImported, setAlreadyImported] = useState(false);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const [recs, maps, withIngs, importedDays] = await Promise.all([
          listRecipes(),
          getMappings(),
          recipesWithIngredients(),
          getImportedDays(),
        ]);
        setAlreadyImported(importedDays.has(parsed.date));
        setRecipes(recs);
        setWithIngredients(withIngs);
        const mapBySifra = new Map(maps.map((m) => [m.sifra, m]));
        // Initial resolution per item: special order → skip; remembered
        // mapping → fuzzy match → empty. A special order's stock moves when its
        // event is completed, so selling it here too would deduct it twice.
        const init: Record<string, string> = {};
        for (const it of parsed.items) {
          const mapped = mapBySifra.get(it.sifra);
          if (isSpecialOrder(it.name)) init[it.sifra] = SKIP;
          else if (mapped) init[it.sifra] = mapped.skip ? SKIP : mapped.recipe_id ?? '';
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

  const specials = useMemo(
    () =>
      parsed.items
        .filter((i) => isSpecialOrder(i.name))
        .map((i) => ({ date: parsed.date, name: i.name, qty: i.qty, amount: i.amount })),
    [parsed],
  );
  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? parsed.items.filter((i) => i.name.toLowerCase().includes(q)) : parsed.items;
  }, [parsed.items, query]);

  const matchedCount = parsed.items.filter((i) => {
    const r = resolutions[i.sifra];
    return r && r !== SKIP;
  }).length;

  // Undecided rows are silently left out of the import — "Прескокни" is a
  // deliberate choice, an empty picker usually isn't.
  const unmatched = parsed.items.filter((i) => !resolutions[i.sifra]);
  // Matched to a recipe with no normativ: the sale is recorded but no stock moves.
  // Only worth flagging when stock is being deducted at all.
  const noNormativ = deduct
    ? [
        ...new Set(
          parsed.items
            .map((i) => resolutions[i.sifra])
            .filter((r) => r && r !== SKIP && !withIngredients.has(r))
            .map((r) => recipes.find((x) => x.id === r)?.name ?? '?'),
        ),
      ]
    : [];

  async function confirm() {
    const problems = [
      alreadyImported
        ? `${fmtDate(parsed.date)} е ВЕЌЕ УВЕЗЕН. Ако продолжиш, продажбите ќе се запишат двапати и залихата ќе се одземе уште еднаш.`
        : '',
      unmatched.length
        ? `${unmatched.length} ставки не се поврзани со рецепт и НЕМА да се увезат:\n` +
          unmatched.map((i) => `• ${i.name} (${i.qty})`).join('\n')
        : '',
      noNormativ.length
        ? `${noNormativ.length} рецепти немаат норматив — продажбата се запишува, но залихата НЕ се одзема:\n` +
          noNormativ.map((n) => `• ${n}`).join('\n')
        : '',
    ].filter(Boolean);
    if (problems.length && !window.confirm(problems.join('\n\n') + '\n\nПродолжи со увозот?')) return;
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
        .map((i) => ({ recipeId: resolutions[i.sifra], qty: i.qty, gratis: i.gratis }));
      const n = await importDaily(parsed.date, items, deduct);
      // Only special orders left on Прескокни: one picked as a recipe was just sold.
      const skipped = new Set(parsed.items.filter((i) => resolutions[i.sifra] === SKIP).map((i) => i.name));
      const ev = await importSpecials(specials.filter((s) => skipped.has(s.name)));
      toast(`Увезени ${n} продажби за ${fmtDate(parsed.date)}.${ev}`, 'success');
      onDone();
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    } finally {
      setBusy(false);
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

      {alreadyImported && (
        <div className="mb-3">
          <ImportWarning
            title={`${fmtDate(parsed.date)} е веќе увезен`}
            hint="Ако касата дала поправен фајл, не го увезувај повторно — поправи ја само разликата во Продажби."
          >
            Повторен увоз ќе ги запише продажбите двапати и ќе ја одземе залихата уште еднаш.
          </ImportWarning>
        </div>
      )}

      {specials.length > 0 && (
        <div className="mb-3">
          <SpecialOrders specials={specials} />
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
                <th className="p-2 text-right">Гратис</th>
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
                    <td className="p-2 text-right text-muted">{it.gratis || ''}</td>
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

      {(unmatched.length > 0 || noNormativ.length > 0) && (
        <div className="mt-4 grid gap-2">
          {unmatched.length > 0 && (
            <ImportWarning
              title={`${unmatched.length} ставки не се поврзани и нема да се увезат`}
              hint="Избери рецепт или „Прескокни“ за секоја од нив."
            >
              {unmatched.map((i) => i.name).join(', ')}
            </ImportWarning>
          )}
          {noNormativ.length > 0 && (
            <ImportWarning
              title={`${noNormativ.length} рецепти немаат норматив — залихата нема да се одземе`}
              hint="Додади состојки во Рецепти, или увези вака и одземи рачно подоцна."
            >
              {noNormativ.join(', ')}
            </ImportWarning>
          )}
        </div>
      )}

      <div className="mt-4 flex justify-end gap-2">
        <button className="btn-ghost" onClick={onDone}>Откажи</button>
        <button className="btn-primary" onClick={confirm} disabled={busy}>
          {busy ? 'Увезување…' : 'Увези продажби'}
        </button>
      </div>
    </div>
  );
}
