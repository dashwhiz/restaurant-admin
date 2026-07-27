'use client';

import { useCallback, useEffect, useState } from 'react';
import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { useToast } from '@/components/ui/Toast';
import { isSupabaseConfigured } from '@/lib/supabase';
import { getSession, requireAuth, signOut } from '@/lib/services/auth';
import { getTableCounts, probeScanner, type TableCount } from '@/lib/services/health';
import { clearAllData, clearSection, CLEARABLE, type ClearableKey } from '@/lib/services/admin';
import { BACKUP_TABLES, exportAllTables } from '@/lib/services/backup';
import { fmtDateTime } from '@/lib/format';
import { getTheme, setTheme, THEME_LABELS, type Theme } from '@/lib/theme';

// Injected by the deploy workflow. Empty locally — there's no commit to report.
const COMMIT_SHA = process.env.NEXT_PUBLIC_COMMIT_SHA || '';
const BUILD_TIME = process.env.NEXT_PUBLIC_BUILD_TIME || '';
const isDev = process.env.NODE_ENV !== 'production';

export default function SettingsPage() {
  const toast = useToast();
  const [wiping, setWiping] = useState(false);
  const [clearing, setClearing] = useState<ClearableKey | null>(null);
  const [email, setEmail] = useState<string | null>(null);
  const [counts, setCounts] = useState<TableCount[] | null>(null);
  const [scannerOk, setScannerOk] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(false);
  const [backingUp, setBackingUp] = useState(false);
  const [progress, setProgress] = useState('');
  // Read on mount, not during render: localStorage doesn't exist while the page
  // is prerendered at build time.
  const [theme, setThemeState] = useState<Theme>('system');

  useEffect(() => {
    setThemeState(getTheme());
  }, []);

  function chooseTheme(next: Theme) {
    setTheme(next);
    setThemeState(next);
  }

  const runChecks = useCallback(async () => {
    setChecking(true);
    try {
      const [rows, scanner] = await Promise.all([getTableCounts(), probeScanner()]);
      setCounts(rows);
      setScannerOk(scanner);
    } catch (e) {
      toast('Проверката не успеа: ' + (e as Error).message, 'error');
    } finally {
      setChecking(false);
    }
  }, [toast]);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    getSession().then((s) => setEmail(s?.user.email ?? null));
    runChecks();
  }, [runChecks]);

  async function backup() {
    setBackingUp(true);
    setProgress(`0/${BACKUP_TABLES.length}`);
    try {
      const { saved, empty } = await exportAllTables((p) => setProgress(`${p.done}/${p.total}`));
      const rows = saved.reduce((sum, s) => sum + s.rows, 0);
      const skipped = empty.length ? `, ${empty.length} празни прескокнати` : '';
      toast(`Преземени ${saved.length} датотеки (${rows.toLocaleString('mk-MK')} записи)${skipped}`, 'success');
    } catch (e) {
      toast('Резервната копија не успеа: ' + (e as Error).message, 'error');
    } finally {
      setBackingUp(false);
      setProgress('');
    }
  }

  async function clearOne(key: ClearableKey, label: string) {
    if (!confirm(`Избриши ги сите: ${label}?\n\nОваа акција НЕ МОЖЕ да се поништи.`)) return;
    setClearing(key);
    try {
      await clearSection(key);
      toast(`Избришано: ${label}`, 'success');
      runChecks();
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    } finally {
      setClearing(null);
    }
  }

  async function wipe() {
    if (!confirm('ВНИМАНИЕ: ова ги брише СИТЕ податоци (производи, рецепти, продажби, испораки, отпад, попис, настани, POS увози). Не може да се врати. Продолжи?')) return;
    if (!confirm('Последна потврда — избриши сè?')) return;
    setWiping(true);
    try {
      await clearAllData();
      toast('Сите податоци се избришани', 'success');
      runChecks();
    } catch (e) {
      toast('Грешка: ' + (e as Error).message, 'error');
    } finally {
      setWiping(false);
    }
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  let host = '—';
  try {
    host = url ? new URL(url).host : '—';
  } catch {
    host = url;
  }

  return (
    <>
      <PageHeader
        title="Поставки"
        subtitle="Состојба на системот"
        actions={
          <button className="btn-ghost" onClick={runChecks} disabled={checking || !isSupabaseConfigured}>
            {checking ? 'Проверува…' : 'Провери повторно'}
          </button>
        }
      />

      <div className="grid gap-4">
        <div className="card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Најава</h2>
          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">Најавен како</span>
            <span className="truncate font-mono">{email ?? '—'}</span>
          </div>
          {requireAuth && (
            <button className="btn-ghost mt-3" onClick={() => signOut()}>
              Одјави се
            </button>
          )}
        </div>

        <div className="card">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">Изглед</h2>
          <p className="mb-3 text-xs text-muted">
            Важи само за овој уред и прелистувач.
          </p>
          <div className="flex flex-wrap gap-2">
            {(['light', 'dark', 'system'] as Theme[]).map((option) => (
              <button
                key={option}
                // Selection isn't an action — the one primary button on this
                // screen stays the backup. Selected reads as an outlined state.
                className={
                  option === theme ? 'btn-ghost border-primary text-primary' : 'btn-ghost'
                }
                aria-pressed={option === theme}
                onClick={() => chooseTheme(option)}
              >
                {THEME_LABELS[option]}
              </button>
            ))}
          </div>
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Состојба</h2>

          <div className="flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">База (Supabase)</span>
            {isSupabaseConfigured ? <Badge tone="green">Поврзано</Badge> : <Badge tone="red">Не е поврзано</Badge>}
          </div>
          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">Проект</span>
            <span className="truncate font-mono text-xs">{host}</span>
          </div>

          <div className="mt-2 flex items-center justify-between gap-3 text-sm">
            <span className="text-muted">Скенер на фактури</span>
            {scannerOk === null ? (
              <Badge tone="gray">Се проверува…</Badge>
            ) : scannerOk ? (
              <Badge tone="green">Достапен</Badge>
            ) : (
              <Badge tone="red">Недостапен</Badge>
            )}
          </div>

          <div className="mt-4 border-t border-border pt-3">
            <p className="label">Записи во базата</p>
            {counts === null ? (
              <p className="text-sm text-muted">Се вчитува…</p>
            ) : (
              <dl className="grid grid-cols-2 gap-x-4 gap-y-1 sm:grid-cols-3">
                {counts.map((c) => (
                  <div key={c.table} className="flex items-baseline justify-between gap-2 text-sm">
                    <dt className="truncate text-muted">{c.label}</dt>
                    <dd className={`font-semibold ${c.count === null ? 'text-danger' : ''}`}>
                      {c.count === null ? '—' : c.count.toLocaleString('mk-MK')}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Верзија</h2>
          {COMMIT_SHA ? (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
              <span className="font-mono">{COMMIT_SHA.slice(0, 7)}</span>
              {BUILD_TIME && <span className="text-muted">· објавено {fmtDateTime(BUILD_TIME)}</span>}
            </div>
          ) : (
            <p className="text-sm text-muted">Локална верзија (не е објавена).</p>
          )}
          {isDev && (
            <p className="mt-3 text-xs text-muted">
              Врската се менува во <code className="rounded bg-background px-1">.env.local</code>{' '}
              (потоа рестартирај го серверот).
            </p>
          )}
        </div>

        <div className="card">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-muted">Резервна копија</h2>
          <p className="mb-3 text-xs text-muted">
            Презема по една CSV датотека за секоја табела ({BACKUP_TABLES.length} вкупно). Се
            отвораат во Excel. Прелистувачот ќе побара дозвола за повеќе преземања.
          </p>
          <button className="btn-primary" onClick={backup} disabled={backingUp}>
            {backingUp ? `Презема… ${progress}` : 'Преземи резервна копија (CSV)'}
          </button>
        </div>

        <div className="card">
          <h2 className="mb-1 text-sm font-bold uppercase tracking-wide text-muted">
            Исчисти по секција
          </h2>
          <p className="mb-3 text-xs text-muted">
            Брише само една област — обично кога увоз тргнал наопаку. Не може да се врати.
          </p>
          <div className="flex flex-wrap gap-2">
            {CLEARABLE.map((s) => (
              <button
                key={s.key}
                className="btn-ghost"
                disabled={clearing !== null}
                onClick={() => clearOne(s.key, s.label)}
              >
                {clearing === s.key ? 'Брише…' : s.label}
              </button>
            ))}
          </div>
        </div>

        <div className="card border-danger/40">
          <h2 className="mb-2 text-sm font-bold uppercase tracking-wide text-danger">Опасна зона</h2>
          <p className="mb-2 text-xs text-muted">
            Ги брише <strong>сите</strong> податоци од сите 12 табели: производи, рецепти,
            состојки, испораки, продажби, отпад, попис, настани и POS увозите.
          </p>
          <p className="mb-3 text-xs font-semibold text-danger">
            Нема резервна копија и нема враќање назад.
          </p>
          <button className="btn-danger" onClick={wipe} disabled={wiping}>
            {wiping ? 'Бришење…' : 'Избриши ги сите податоци'}
          </button>
        </div>
      </div>
    </>
  );
}
