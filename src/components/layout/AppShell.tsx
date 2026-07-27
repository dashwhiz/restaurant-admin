'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { NAV } from './nav';
import { Login } from './Login';
import { ToastProvider } from '@/components/ui/Toast';
import { isSupabaseConfigured } from '@/lib/supabase';
import { requireAuth, getSession, onAuthChange, signOut } from '@/lib/services/auth';
import { IconMenu } from '@/components/ui/Icons';

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  // 'loading' until we know; 'in' = show app; 'out' = show login.
  const [auth, setAuth] = useState<'loading' | 'in' | 'out'>(requireAuth ? 'loading' : 'in');

  useEffect(() => {
    if (!requireAuth || !isSupabaseConfigured) return;
    getSession().then((s) => setAuth(s ? 'in' : 'out'));
    return onAuthChange((s) => setAuth(s ? 'in' : 'out'));
  }, []);

  if (!isSupabaseConfigured) return <NotConfigured />;
  if (auth === 'loading') return <Centered>Вчитување…</Centered>;
  if (auth === 'out') return <Login />;

  const isActive = (href: string) =>
    href === '/' ? pathname === '/' : pathname.startsWith(href);

  const navLinks = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map(({ href, label, icon: Icon }) => (
        <Link
          key={href}
          href={href}
          onClick={() => setOpen(false)}
          className={`flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
            isActive(href)
              ? 'bg-primary/12 text-primary'
              : 'text-foreground/80 hover:bg-background'
          }`}
        >
          <Icon className="h-5 w-5 shrink-0" />
          {label}
        </Link>
      ))}
    </nav>
  );

  const sidebarInner = (
    <>
      <div className="mb-4 px-2 pt-2 text-lg font-extrabold tracking-tight">🍽️ Лира</div>
      {navLinks}
      {requireAuth && (
        <button
          onClick={() => signOut()}
          className="mt-auto rounded-lg px-3 py-2 text-left text-sm text-muted hover:bg-background"
        >
          Одјава
        </button>
      )}
    </>
  );

  return (
    <ToastProvider>
      <div className="flex min-h-dvh">
        <aside className="sticky top-0 hidden h-dvh w-60 shrink-0 flex-col border-r border-border bg-surface p-3 md:flex">
          {sidebarInner}
        </aside>

        {open && (
          <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <aside
              className="absolute left-0 top-0 flex h-full w-64 flex-col border-r border-border bg-surface p-3"
              onClick={(e) => e.stopPropagation()}
            >
              {sidebarInner}
            </aside>
          </div>
        )}

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex items-center gap-3 border-b border-border bg-surface p-3 md:hidden">
            <button onClick={() => setOpen(true)} aria-label="Мени">
              <IconMenu className="h-6 w-6" />
            </button>
            <span className="font-extrabold">🍽️ Лира</span>
          </header>
          <main className="mx-auto w-full max-w-6xl flex-1 p-4 sm:p-6">{children}</main>
        </div>
      </div>
    </ToastProvider>
  );
}

function Centered({ children }: { children: ReactNode }) {
  return <div className="flex min-h-dvh items-center justify-center text-sm text-muted">{children}</div>;
}

function NotConfigured() {
  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <div className="card max-w-md text-center">
        <div className="mb-2 text-3xl">🔌</div>
        <h1 className="mb-2 text-lg font-bold">Базата не е поврзана</h1>
        <p className="text-sm text-muted">
          Копирај <code className="rounded bg-background px-1">.env.local.example</code> во{' '}
          <code className="rounded bg-background px-1">.env.local</code>, внеси ги вредностите од
          Supabase и рестартирај го серверот (<code className="rounded bg-background px-1">npm run dev</code>).
        </p>
      </div>
    </div>
  );
}
