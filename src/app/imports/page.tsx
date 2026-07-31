'use client';

import { useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { useToast } from '@/components/ui/Toast';
import { IconImport } from '@/components/ui/Icons';
import { listProducts } from '@/lib/services/products';
import { listRecipes } from '@/lib/services/recipes';
import { importSifrarnik, importNormativi, importCenovnik } from '@/lib/services/imports';
import {
  detectFormat,
  parseSifrarnik,
  parseNormativi,
  parseCenovnik,
  parseDaily,
  type SifrarnikResult,
  type ParsedNormativ,
  type ParsedPrice,
  type ParsedDaily,
} from '@/lib/pos/parse';
import { DailyPreview } from './components/DailyPreview';
import { BulkDailyPreview } from './components/BulkDailyPreview';

type Loaded =
  | { kind: 'sitesifri' | 'prodazni'; label: string; result: SifrarnikResult }
  | { kind: 'normativi'; label: string; parsed: ParsedNormativ[] }
  | { kind: 'cenovnik'; label: string; parsed: ParsedPrice[] }
  | { kind: 'daily'; label: string; parsed: ParsedDaily }
  | { kind: 'bulk-daily'; label: string; files: ParsedDaily[] };

const LABELS: Record<string, string> = {
  sitesifri: 'Шифрарник (производи + рецепти)',
  prodazni: 'Продажен шифрарник',
  normativi: 'Нормативи (состојки)',
  cenovnik: 'Ценовник (цени)',
  daily: 'Дневна продажба',
};

export default function ImportsPage() {
  const toast = useToast();
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [doProducts, setDoProducts] = useState(true);
  const [doRecipes, setDoRecipes] = useState(true);
  const [busy, setBusy] = useState(false);

  async function onFiles(fileList: FileList) {
    const files = Array.from(fileList);
    try {
      // Several files at once only makes sense for daily sales — the other
      // formats are single master files where a second one just replaces the
      // first. Anything else, fall back to reading the first file.
      if (files.length > 1) {
        const texts = await Promise.all(files.map((f) => f.text()));
        const formats = texts.map(detectFormat);
        if (!formats.every((f) => f === 'daily')) {
          return toast('Повеќе фајлови може да се вчитаат само за дневна продажба', 'error');
        }
        return setLoaded({
          kind: 'bulk-daily',
          label: `${files.length} дневни фајлови`,
          files: texts.map(parseDaily),
        });
      }

      const text = await files[0].text();
      const fmt = detectFormat(text);
      if (fmt === 'unknown') return toast('Непознат формат на фајлот', 'error');
      const label = LABELS[fmt];
      if (fmt === 'sitesifri' || fmt === 'prodazni') setLoaded({ kind: fmt, label, result: parseSifrarnik(text) });
      else if (fmt === 'normativi') setLoaded({ kind: 'normativi', label, parsed: parseNormativi(text) });
      else if (fmt === 'cenovnik') setLoaded({ kind: 'cenovnik', label, parsed: parseCenovnik(text) });
      else setLoaded({ kind: 'daily', label, parsed: parseDaily(text) });
    } catch (e) {
      toast('Грешка при читање: ' + (e as Error).message, 'error');
    }
  }

  const reset = () => {
    setLoaded(null);
    setDoProducts(true);
    setDoRecipes(true);
  };

  async function confirmSifrarnik(result: SifrarnikResult) {
    setBusy(true);
    try {
      const r = await importSifrarnik(result.products, result.recipes, { doProducts, doRecipes });
      const skipped = r.skippedProducts + r.skippedRecipes;
      toast(
        `Увезено: ${r.products} производи, ${r.recipes} рецепти` +
          (skipped ? ` (${skipped} веќе постоеја, прескокнати)` : ''),
        'success',
      );
      reset();
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function confirmNormativi(parsed: ParsedNormativ[]) {
    setBusy(true);
    try {
      const [recs, prods] = await Promise.all([listRecipes(), listProducts()]);
      const r = await importNormativi(parsed, recs, prods);
      toast(`Поврзани ${r.linked} рецепти${r.newProducts ? `, создадени ${r.newProducts} нови производи` : ''}`, 'success');
      reset();
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  async function confirmCenovnik(parsed: ParsedPrice[]) {
    setBusy(true);
    try {
      const recs = await listRecipes();
      const r = await importCenovnik(parsed, recs);
      toast(`Ажурирани ${r.updated} цени`, 'success');
      reset();
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <PageHeader title="Увоз" subtitle="Вчитај ги POS фајловите (шифрарник, нормативи, ценовник, дневна продажба)" />

      {!loaded ? (
        <label className="card flex cursor-pointer flex-col items-center gap-2 border-dashed py-12 text-center">
          <IconImport className="h-8 w-8 text-muted" />
          <span className="font-semibold">Избери или довлечи .TXT фајл</span>
          <span className="text-xs text-muted">Форматот се препознава автоматски · може повеќе дневни фајлови одеднаш</span>
          <input
            type="file"
            accept=".txt,.TXT,text/plain"
            className="hidden"
            multiple
            onChange={(e) => e.target.files?.length && onFiles(e.target.files)}
          />
        </label>
      ) : (
        <div className="card">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-bold">{loaded.label}</h2>
            <button className="btn-ghost" onClick={reset}>Друг фајл</button>
          </div>

          {(loaded.kind === 'sitesifri' || loaded.kind === 'prodazni') && (
            <div>
              <div className="mb-4 grid grid-cols-2 gap-3">
                <Stat label="Производи" value={loaded.result.products.length} />
                <Stat label="Рецепти" value={loaded.result.recipes.length} />
              </div>
              <div className="mb-4 flex flex-col gap-2 text-sm">
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={doProducts} onChange={(e) => setDoProducts(e.target.checked)} /> Увези производи
                </label>
                <label className="flex items-center gap-2">
                  <input type="checkbox" checked={doRecipes} onChange={(e) => setDoRecipes(e.target.checked)} /> Увези рецепти
                </label>
              </div>
              <button className="btn-primary" disabled={busy} onClick={() => confirmSifrarnik(loaded.result)}>
                {busy ? 'Увезување…' : 'Увези во апликацијата'}
              </button>
            </div>
          )}

          {loaded.kind === 'normativi' && (
            <div>
              <p className="mb-4 text-sm text-muted">
                {loaded.parsed.length} рецепти во фајлот. Ќе се спојат со постојните рецепти по име и ќе се
                постават нивните состојки.
              </p>
              <button className="btn-primary" disabled={busy} onClick={() => confirmNormativi(loaded.parsed)}>
                {busy ? 'Увезување…' : 'Поврзи состојки'}
              </button>
            </div>
          )}

          {loaded.kind === 'cenovnik' && (
            <div>
              <p className="mb-4 text-sm text-muted">
                {loaded.parsed.length} артикли со цени. Ќе се ажурираат само рецептите што постојат.
              </p>
              <button className="btn-primary" disabled={busy} onClick={() => confirmCenovnik(loaded.parsed)}>
                {busy ? 'Увезување…' : 'Ажурирај цени'}
              </button>
            </div>
          )}

          {loaded.kind === 'daily' && <DailyPreview parsed={loaded.parsed} onDone={reset} />}
          {loaded.kind === 'bulk-daily' && <BulkDailyPreview files={loaded.files} onDone={reset} />}
        </div>
      )}
    </>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-border p-3 text-center">
      <div className="text-2xl font-extrabold">{value}</div>
      <div className="text-xs text-muted">{label}</div>
    </div>
  );
}
