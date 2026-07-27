'use client';

import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { fmtDate } from '@/lib/format';
import { bestMatch } from '@/lib/pos/match';
import type { ParsedDaily } from '@/lib/pos/parse';
import { listRecipes } from '@/lib/services/recipes';
import {
  getImportedDays,
  getMappings,
  saveMappings,
  importDaily,
  type DailySaleInput,
  type MappingInput,
} from '@/lib/services/imports';

const SKIP = '__skip__';

interface DayPlan {
  date: string;
  totalItems: number;
  matched: DailySaleInput[];
  unmatchedNames: string[];
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
        const [recipes, maps, importedDays] = await Promise.all([
          listRecipes(),
          getMappings(),
          getImportedDays(),
        ]);
        const bySifra = new Map(maps.map((m) => [m.sifra, m]));
        const learned: MappingInput[] = [];

        // Oldest first: stock moves in the order the days actually happened.
        const sorted = [...files].sort((a, b) => a.date.localeCompare(b.date));
        const built = sorted.map<DayPlan>((file) => {
          const matched: DailySaleInput[] = [];
          const unmatchedNames: string[] = [];
          for (const item of file.items) {
            const remembered = bySifra.get(item.sifra);
            if (remembered?.skip) continue;
            const recipeId = remembered?.recipe_id ?? bestMatch(item.name, recipes)?.item.id ?? '';
            if (!recipeId) {
              unmatchedNames.push(item.name);
              continue;
            }
            if (!remembered) learned.push({ sifra: item.sifra, recipe_id: recipeId, skip: false });
            matched.push({ recipeId, qty: item.qty });
          }
          return {
            date: file.date,
            totalItems: file.items.length,
            matched,
            unmatchedNames,
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

  async function importAll() {
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
