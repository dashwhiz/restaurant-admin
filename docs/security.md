# Security

## Dependency policy (before installing anything)

Supply-chain attacks on npm are real. **Before adding any package:**

1. Web-search the *specific* package + version for `malware / compromised /
   advisory 2026`; check npm advisories, Snyk, or socket.dev.
2. Make sure it's the **official** package. Typosquats exist — e.g.
   `supabase-javascript` is malware; the real client is `@supabase/supabase-js`.
3. Pin a patched version and note in the commit why it was added.
4. Run `npm audit`. **`npm audit --omit=dev` (runtime) must be clean.**

Keep dependencies minimal. Current runtime deps: `next`, `react`, `react-dom`,
`@supabase/supabase-js`. Everything else is dev-only (TypeScript, ESLint, Tailwind).

## Current audit state

- **Runtime: 0 vulnerabilities** (`npm audit --omit=dev`).
- Overrides pin patched transitive deps: `sharp@0.35.3`, `postcss@^8.5.18`.
- **~9 accepted dev-only advisories** in the ESLint tooling chain
  (`brace-expansion`/`minimatch`). They run only at lint time on our own trusted
  code and never ship in the app. `npm audit fix --force` "fixes" them by
  downgrading Next.js to an ancient version — do **not** run it. Re-check when
  ESLint/Next release updated tooling.

## Hosting & the anon key ⚠️

The app is client-side, so the Supabase **anon key is in the browser bundle**,
and the database currently has **Row-Level Security (RLS) disabled**. That means:

- ✅ **Local use is fine** — the bundle lives on your machine only.
- ❌ **A public deploy (GitHub Pages / Vercel / …) would expose the whole
  database** to anyone who finds the URL, because RLS is off and the key is public.

**Before any public deploy**, do both:
1. Add a login (Supabase Auth) so only the restaurant can use it.
2. Enable RLS on every table and add policies (authenticated users only).

The Anthropic invoice-scan key is **already** kept off the browser: it lives in
a Supabase Edge Function secret (`supabase/functions/scan-invoice`), never in
`NEXT_PUBLIC_` and never in the bundle. See
[`features/invoice-scan.md`](./features/invoice-scan.md).

## Secrets

`.env.local` holds the keys and is git-ignored (`.gitignore` has `.env*`). Never
commit real keys. `.env.local.example` documents the names only, no values.
