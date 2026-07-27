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
`@supabase/supabase-js`, `recharts`. Everything else is dev-only (TypeScript,
ESLint, Tailwind).

**`recharts` is pinned to an exact version (`3.9.2`, no `^`).** Charting packages
were actively targeted through compromised maintainer accounts in 2026
(`echarts-for-react`, `@antv/f-charts`, `@antv/chart-node-g6` all shipped malware
in the May 2026 wave), and `recharts-smart` is a known malware typosquat of it.
When bumping it, **don't take a release that is only days old** — let it sit long
enough to be scrutinised, and re-run the check above. Note it also pulls redux
(`@reduxjs/toolkit`, `react-redux`) in transitively.

## Current audit state

- **Runtime: 0 vulnerabilities** (`npm audit --omit=dev`).
- Overrides pin patched transitive deps: `sharp@0.35.3`, `postcss@^8.5.18`.
- **~9 accepted dev-only advisories** in the ESLint tooling chain
  (`brace-expansion`/`minimatch`). They run only at lint time on our own trusted
  code and never ship in the app. `npm audit fix --force` "fixes" them by
  downgrading Next.js to an ancient version — do **not** run it. Re-check when
  ESLint/Next release updated tooling.

## Hosting & the anon key

The app is client-side, so the Supabase **anon key is in the browser bundle** —
anyone can read it out of the JavaScript. That is fine, and intended: the anon
key is a public identifier, not a password. **Row-Level Security is what
protects the data**, and it is now enabled.

Both pieces are in place (set up 2026-07-27):

1. **Login** — Supabase Auth. `NEXT_PUBLIC_REQUIRE_AUTH=true` in both the
   deployed build and `.env.local`, so the app refuses to load data without a
   session. Users are created by hand in the dashboard; **public sign-up is
   off**, so nobody can enrol themselves.
2. **RLS on every table** — `supabase/rls.sql` enables RLS and grants a single
   policy, `"authenticated full access"`, to the `authenticated` role. With the
   anon key alone every table returns an empty result.

### ⚠️ Adding a table? Update `supabase/rls.sql`

`rls.sql` walks a **hardcoded list** of table names — it is not "every table in
the schema". A new table created outside that list has RLS **off** and is
readable and writable by anyone with the anon key.

So whenever you add a table: add its name to the array in `supabase/rls.sql` and
re-run the whole script in the SQL Editor. It is safe to re-run — it skips
tables that don't exist and replaces the policy rather than duplicating it.

### The policy is deliberately coarse

`using (true) with check (true)` means any logged-in user has full access to
everything. That is correct for a single restaurant with a handful of
hand-created accounts, and per-user policies would be over-engineering. It does
mean **public sign-up must stay off** — Authentication → Sign In / Providers →
Email → "Allow new users to sign up". If that were ever switched on, a stranger
who registered would get the whole database.

### Verifying it still holds

From any terminal, with the public anon key:

```bash
curl -s "https://sawvyrwtnwrqiwhnzypw.supabase.co/rest/v1/products?select=*&limit=1" \
  -H "apikey: <anon key>" -H "Authorization: Bearer <anon key>"
```

Expected: `[]`. If real rows come back, RLS is off on that table — fix it before
anything else. (A blocked read returns `200` with an empty array, not an error,
so an empty result is the pass condition.)

The Anthropic invoice-scan key is **already** kept off the browser: it lives in
a Supabase Edge Function secret (`supabase/functions/scan-invoice`), never in
`NEXT_PUBLIC_` and never in the bundle. See
[`features/invoice-scan.md`](./features/invoice-scan.md).

## Secrets

`.env.local` holds the keys and is git-ignored (`.gitignore` has `.env*`). Never
commit real keys. `.env.local.example` documents the names only, no values.
