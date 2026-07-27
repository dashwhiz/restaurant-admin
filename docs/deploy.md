# Deploying to GitHub Pages

The app builds to a **static site** (`out/`) and is published by the workflow in
`.github/workflows/deploy.yml`. Because it will be on a public URL, it's locked
down with a login + Row-Level Security so bots can't touch the data.

## One-time setup

1. **Push the repo** to `github.com/dashwhiz/restaurant-admin` (branch `main`).

2. **Enable Pages:** repo **Settings → Pages → Build and deployment → Source =
   “GitHub Actions.”**

3. **Add the two Actions secrets:** **Settings → Secrets and variables → Actions
   → New repository secret:**
   - `NEXT_PUBLIC_SUPABASE_URL` — your Supabase project URL
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — your Supabase anon key
   (The anon key is public by design; RLS below is what protects the data.)

4. **Lock the database:** in Supabase → **SQL Editor**, run
   [`supabase/rls.sql`](../supabase/rls.sql). This enables RLS on every table and
   allows only logged-in users.

5. **Create the login user:** Supabase → **Authentication → Users → Add user**
   (email + password). This is what you'll log in with. There is no public
   sign-up.

That's it. Every push to `main` rebuilds and redeploys. The site will be at
`https://dashwhiz.github.io/restaurant-admin/`.

## What makes it safe

- The deployed build sets `NEXT_PUBLIC_REQUIRE_AUTH=true`, so the app shows a
  login screen and won't load data without a session.
- RLS means even someone with the anon key + URL gets nothing without logging in.
- The Anthropic (invoice-scan) key is **not** in the build — it lives in a
  Supabase Edge Function secret. Deploy steps: [`setup-checklist.md`](./setup-checklist.md).

## Collaborator access

Add your friend under repo **Settings → Collaborators**. He can then clone/pull
the repo and run it locally (see [`running-locally.md`](./running-locally.md)),
and Claude Code can commit + push changes for him.

## Local vs deployed

| | Local (`npm run dev`) | Deployed (Pages) |
|---|---|---|
| Base path | `/` | `/restaurant-admin` |
| Login | not required (`NEXT_PUBLIC_REQUIRE_AUTH` off) | required |
| RLS | can stay off | **on** (run `rls.sql`) |
| Supabase keys | `.env.local` | Actions secrets |
