'use client';

import { PageHeader } from '@/components/ui/PageHeader';
import { Badge } from '@/components/ui/Badge';
import { isSupabaseConfigured } from '@/lib/supabase';
import { requireAuth, signOut } from '@/lib/services/auth';

export default function SettingsPage() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  let host = '—';
  try {
    host = url ? new URL(url).host : '—';
  } catch {
    host = url;
  }

  return (
    <>
      <PageHeader title="Поставки" subtitle="Врска и конфигурација" />

      <div className="grid gap-4">
        <div className="card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">База (Supabase)</h2>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Статус</span>
            {isSupabaseConfigured ? <Badge tone="green">Поврзано</Badge> : <Badge tone="red">Не е поврзано</Badge>}
          </div>
          <div className="mt-2 flex items-center justify-between text-sm">
            <span className="text-muted">Проект</span>
            <span className="font-mono">{host}</span>
          </div>
          <p className="mt-3 text-xs text-muted">
            Врската се менува во датотеката <code className="rounded bg-background px-1">.env.local</code>{' '}
            (потоа рестартирај го серверот).
          </p>
        </div>

        <div className="card">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide text-muted">Најава</h2>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted">Најава задолжителна</span>
            <Badge tone={requireAuth ? 'green' : 'gray'}>{requireAuth ? 'Да' : 'Не (локално)'}</Badge>
          </div>
          {requireAuth && (
            <button className="btn-ghost mt-3" onClick={() => signOut()}>
              Одјави се
            </button>
          )}
        </div>
      </div>
    </>
  );
}
