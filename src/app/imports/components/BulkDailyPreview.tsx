'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { fmtDate } from '@/lib/format';
import { bestMatch, isSpecialOrder } from '@/lib/pos/match';
import type { ParsedDaily } from '@/lib/pos/parse';
import { listRecipes, recipesWithIngredients } from '@/lib/services/recipes';
import {
  getImportedDays,
  getMappings,
  saveMappings,
  importDaily,
  type DailySaleInput,
  type MappingInput,
} from '@/lib/services/imports';
import type { PosSpecial } from '@/lib/services/events';
import { ImportWarning } from './ImportWarning';
import { SpecialOrders } from './SpecialOrders';

const SKIP = '__skip__';

interface DayPlan {
  date: string;
  totalItems: number;
  matched: DailySaleInput[];
  unmatchedNames: string[];
  /** Matched recipes with no ingredients — sold, but no stock deducted. */
  noNormativNames: string[];
  /** Special-order lines: not sold here, offered as events instead. */
  specials: PosSpecial[];
  alreadyImported: boolean;
}

/**
 * Import a stack of daily POS files in one go — the usual case being a backlog
 * of days nobody got round to entering. Matching is automatic here (remembered
 * mapping, then name match); anything unmatched is reported rather than
 * prompted, because 30 files of dropdowns is not a workflow. Import a single
 * file the normal way to resolve those by hand — the answer is then remembered
 * and the next bulk run picks it up.
 */
export function BulkDailyPreview({ files, onDone }: { files: ParsedDaily[]; onDone: () => void }) {
  const toast = useToast();
  const [plans, setPlans] = useState<DayPlan[] | null>(null);
  const [mappings, setMappings] = useState<MappingInput[]>([]);
  const [deduct, setDeduct] = useState(true);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [recipes, maps, importedDays, withIngredients] = await Promise.all([
          listRecipes(),
          getMappings(),
          getImportedDays(),
          recipesWithIngredients(),
        ]);
        const recipeName = new Map(recipes.map((r) => [r.id, r.name]));
        const bySifra = new Map(maps.map((m) => [m.sifra, m]));
        const learned: MappingInput[] = [];

        // Oldest first: stock moves in the order the days actually happened.
        const sorted = [...files].sort((a, b) => a.date.localeCompare(b.date));
        const built = sorted.map<DayPlan>((file) => {
          const matched: DailySaleInput[] = [];
          const unmatchedNames: string[] = [];
          const noNormativ = new Set<string>();
          const specials: PosSpecial[] = [];
          for (const item of file.items) {
            // Its stock moves when the event is completed — selling it here
            // too would deduct it twice.
            if (isSpecialOrder(item.name)) {
              specials.push({ date: file.date, name: item.name, qty: item.qty, amount: item.amount });
              continue;
            }
            const remembered = bySifra.get(item.sifra);
            if (remembered?.skip) continue;
            const recipeId = remembered?.recipe_id ?? bestMatch(item.name, recipes)?.item.id ?? '';
            if (!recipeId) {
              unmatchedNames.push(item.name);
              continue;
            }
            if (!remembered) learned.push({ sifra: item.sifra, recipe_id: recipeId, skip: false });
            matched.push({ recipeId, qty: item.qty });
            if (!withIngredients.has(recipeId)) noNormativ.add(recipeName.get(recipeId) ?? item.name);
          }
          return {
            date: file.date,
            totalItems: file.items.length,
            matched,
            unmatchedNames,
            noNormativNames: [...noNormativ],
            specials,
            alreadyImported: importedDays.has(file.date),
          };
        });
        setMappings(learned);
        setPlans(built);
      } catch (e) {
        toast('Грешка: ' + (e as Error).message, 'error');
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const importable = plans?.filter((p) => !p.alreadyImported && p.matched.length > 0) ?? [];
  const duplicates = plans?.filter((p) => p.alreadyImported).length ?? 0;

  const withUnmatched = importable.filter((p) => p.unmatchedNames.length > 0);
  const unmatchedTotal = withUnmatched.reduce((n, p) => n + p.unmatchedNames.length, 0);
  // Only matters when stock is being deducted at all.
  const noNormativ = deduct ? [...new Set(importable.flatMap((p) => p.noNormativNames))] : [];
  // Only days being imported now: an earlier import may already have sold them.
  const specials = importable.flatMap((p) => p.specials);

  async function importAll() {
    const problems = [
      unmatchedTotal
        ? `${unmatchedTotal} ставки во ${withUnmatched.length} ден(а) не се поврзани со рецепт и НЕМА да се увезат:\n` +
          withUnmatched.map((p) => `${fmtDate(p.date)}: ${p.unmatchedNames.join(', ')}`).join('\n')
        : '',
      noNormativ.length
        ? `${noNormativ.length} рецепти немаат норматив — продажбата се запишува, но залихата НЕ се одзема:\n` +
          noNormativ.map((n) => `• ${n}`).join('\n')
        : '',
    ].filter(Boolean);
    if (problems.length && !window.confirm(problems.join('\n\n') + '\n\nПродолжи со увозот?')) return;
    setBusy(true);
    try {
      if (mappings.length > 0) await saveMappings(mappings);
      let total = 0;
      for (const [i, plan] of importable.entries()) {
        setProgress(`${i + 1}/${importable.length} · ${fmtDate(plan.date)}`);
        total += await importDaily(plan.date, plan.matched, deduct);
      }
      toast(`Увезени ${total} продажби од ${importable.length} дена`, 'success');
      onDone();
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    } finally {
      setBusy(false);
      setProgress('');
    }
  }

  if (!plans) return <p className="text-sm text-muted">Се подготвува…</p>;

  return (
    <div className="grid gap-4">
      <div className="card">
        <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">
          {files.length} фајлови за увоз
        </h2>
        <p className="mb-3 text-xs text-muted">
          Се увезуваат од најстариот кон најновиот ден. Ставките се поврзуваат автоматски; за
          рачно поврзување увези го денот поединечно.
        </p>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs text-muted">
                <th className="py-1.5 font-semibold">Датум</th>
                <th className="py-1.5 text-right font-semibold">Ставки</th>
                <th className="py-1.5 text-right font-semibold">Поврзани</th>
                <th className="py-1.5 pl-2 font-semibold">Состојба</th>
              </tr>
            </thead>
            <tbody>
              {plans.map((p) => (
                <tr key={p.date} className="border-b border-border last:border-0">
                  <td className="py-1.5 pr-2 whitespace-nowrap">{fmtDate(p.date)}</td>
                  <td className="py-1.5 text-right">{p.totalItems}</td>
                  <td className="py-1.5 text-right">{p.matched.length}</td>
                  <td className="py-1.5 pl-2">
                    {p.alreadyImported ? (
                      <Badge tone="yellow">веќе увезен</Badge>
                    ) : p.unmatchedNames.length > 0 ? (
                      <Badge tone="gray">{p.unmatchedNames.length} неповрзани</Badge>
                    ) : (
                      <Badge tone="green">подготвен</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {duplicates > 0 && (
          <p className="mt-3 text-xs text-warning">
            {duplicates} ден(а) се веќе увезени и ќе бидат прескокнати — повторен увоз би ги
            удвоил продажбите и залихата.
          </p>
        )}
      </div>

      <SpecialOrders specials={specials} />

      {unmatchedTotal > 0 && (
        <ImportWarning
          title={`${unmatchedTotal} ставки во ${withUnmatched.length} ден(а) не се поврзани и нема да се увезат`}
          hint="За да ги поврзеш, увези го тој ден поединечно — изборот се памти за следниот пат."
        >
          <ul>
            {withUnmatched.map((p) => (
              <li key={p.date}>
                {fmtDate(p.date)}: {p.unmatchedNames.join(', ')}
              </li>
            ))}
          </ul>
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

      <div className="card">
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={deduct} onChange={(e) => setDeduct(e.target.checked)} />
          Одземи од залиха
        </label>
        <div className="mt-3 flex flex-wrap gap-2">
          <button className="btn-primary" onClick={importAll} disabled={busy || importable.length === 0}>
            {busy ? `Увезува… ${progress}` : `Увези ${importable.length} дена`}
          </button>
          <button className="btn-ghost" onClick={onDone} disabled={busy}>
            Откажи
          </button>
        </div>
      </div>
    </div>
  );
}
