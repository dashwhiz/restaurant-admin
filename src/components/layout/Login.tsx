'use client';

import { useState } from 'react';
import { signIn } from '@/lib/services/auth';
import { IconLogo } from '@/components/ui/Icons';

/** Email + password login shown when auth is required and there's no session. */
export function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await signIn(email.trim(), password);
      // AppShell's auth listener picks up the new session and shows the app.
    } catch (err) {
      setError('Погрешен е-маил или лозинка.');
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh items-center justify-center p-6">
      <form onSubmit={submit} className="card w-full max-w-sm">
        <div className="mb-4 flex items-center justify-center gap-2 text-lg font-extrabold">
          <IconLogo className="h-6 w-6 text-primary" /> Лира
        </div>
        <label className="label">Е-маил</label>
        <input
          className="input mb-3"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="username"
          required
        />
        <label className="label">Лозинка</label>
        <input
          className="input mb-4"
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          required
        />
        {error && <p className="mb-3 text-sm text-danger">{error}</p>}
        <button className="btn-primary w-full" disabled={busy}>
          {busy ? 'Најавување…' : 'Најави се'}
        </button>
      </form>
    </div>
  );
}
