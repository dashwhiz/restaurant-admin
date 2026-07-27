# Deploying to GitHub Pages

The app builds to a **static site** (`out/`) and is published by the workflow in
`.github/workflows/deploy.yml`. Because it will be on a public URL, it's locked
down with a login + Row-Level Security so bots can't touch the data.

## Setup — done (2026-07-27)

The site is live at `https://dashwhiz.github.io/restaurant-admin/` and every push
to `main` rebuilds and redeploys it. Nothing below needs doing again; it's
recorded so it can be rebuilt or checked.

1. **Repo** pushed to `github.com/dashwhiz/restaurant-admin` (branch `main`).
2. **Pages** — Settings → Pages → Build and deployment → Source = "GitHub Actions."
3. **Actions secrets** — Settings → Secrets and variables → Actions:
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.
   (The anon key is public by design; RLS is what protects the data.)
4. **Database locked** — [`supabase/rls.sql`](../supabase/rls.sql) run in the SQL
   Editor: RLS on for every table, logged-in users only.
5. **Login user** created under Authentication → Users, with public sign-up
   turned **off**.
6. **Invoice scanner** deployed — see [the scanner section](#invoice-scanner) below.

## What makes it safe

- The deployed build sets `NEXT_PUBLIC_REQUIRE_AUTH=true`, so the app shows a
  login screen and won't load data without a session.
- RLS means even someone with the anon key + URL gets nothing without logging in.
- The Anthropic (invoice-scan) key is **not** in the build — it lives in a
  Supabase Edge Function secret. See below.

## Invoice scanner

Deployed as the Supabase Edge Function `scan-invoice`; the Anthropic key is a
server-side secret, never in the bundle. It's already live — these are the
commands, for reference or redeploy after editing
`supabase/functions/scan-invoice/index.ts`:

```bash
supabase login --token sbp_...                    # personal access token
supabase link --project-ref sawvyrwtnwrqiwhnzypw
supabase functions deploy scan-invoice
```

The `ANTHROPIC_API_KEY` secret is set in the dashboard (**Edge Functions →
Secrets**), which keeps it out of shell history. `supabase secrets list` shows a
hash of it, never the value. Docker isn't needed — the CLI uploads the source and
bundles it server-side, so the "Docker is not running" warning is harmless.

Check it's alive: `supabase functions list` should show `scan-invoice` as
`ACTIVE` with `verify_jwt: true`. Full background:
[`features/invoice-scan.md`](./features/invoice-scan.md).

## Collaborator access

Add your friend under repo **Settings → Collaborators**. He can then clone/pull
the repo and run it locally (see [`running-locally.md`](./running-locally.md)),
and Claude Code can commit + push changes for him.

## Local vs deployed

Local and deployed now hit the **same locked database**, so local needs a login
too — that's the only thing that changed when RLS went on.

| | Local (`npm run dev`) | Deployed (Pages) |
|---|---|---|
| Base path | `/` | `/restaurant-admin` |
| Login | **required** (`NEXT_PUBLIC_REQUIRE_AUTH=true`) | required |
| RLS | on (same database) | on |
| Supabase keys | `.env.local` | Actions secrets |

If local pages come up **empty rather than erroring**, that's RLS with no
session — check you're logged in and that `.env.local` has
`NEXT_PUBLIC_REQUIRE_AUTH=true`. Restart `npm run dev` after changing it; env
vars are only read at startup.
