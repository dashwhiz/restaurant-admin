# Setup checklist — what's left to do

This is the "finish setup" list. The app code is complete; these are the
one-time things that happen **outside** the code (in Supabase and on GitHub).
Do them in order. Each step says what it's for and how to check it worked.

Project ref (Supabase): **`sawvyrwtnwrqiwhnzypw`**
Repo: **`dashwhiz/restaurant-admin`**

---

## A. Database (Supabase) — do this first

Everything except the two items below already exists in the database (it's the
same one the old app used).

### A1. Add the `pos_mappings` table  ·  *needed for: POS import remembering matches*

Without it, POS daily import still works but won't remember which šifra maps to
which recipe. In Supabase → **SQL Editor**, run:

```sql
create table if not exists pos_mappings (
  id uuid default gen_random_uuid() primary key,
  sifra text not null unique,
  recipe_id uuid references recipes(id) on delete cascade,
  skip boolean default false,
  created_at timestamptz default now()
);
alter table pos_mappings disable row level security;
```

**Check:** Table Editor shows a `pos_mappings` table.

### A2. (Only before a public deploy) Turn on security  ·  *needed for: GitHub Pages*

Skip this while testing locally. Before putting the app on the internet, run
`supabase/rls.sql` in the SQL Editor and create a login user — details in
section C.

---

## B. Invoice scanner (Supabase Edge Function) — do this together

The scanner (`/scan` page) sends the photo to a small server function that holds
the Anthropic key, so the key is never in the browser. Background:
[`features/invoice-scan.md`](./features/invoice-scan.md).

You need: the **Supabase CLI** and an **Anthropic API key**
(from <https://console.anthropic.com> → API keys).

### B1. Install the Supabase CLI (one time, on the friend's Mac)

```bash
brew install supabase/tap/supabase
supabase --version   # confirms it's installed
```

(No Homebrew? See <https://supabase.com/docs/guides/cli> for other installers.)

### B2. Log in and link the project

```bash
supabase login                                   # opens the browser to authorize
supabase link --project-ref sawvyrwtnwrqiwhnzypw # run from the repo folder
```

### B3. Store the Anthropic key as a server secret (NOT in any file)

```bash
supabase secrets set ANTHROPIC_API_KEY=sk-ant-...your-key...
```

This lives only on Supabase's servers. Never commit it, never put it in
`.env.local`.

### B4. Deploy the function

```bash
supabase functions deploy scan-invoice
```

**Check:** Supabase dashboard → **Edge Functions** lists `scan-invoice`. Then open
the app, go to **Скенирај фактура**, upload a photo of an invoice, and confirm the
review table fills in. If it says *"ANTHROPIC_API_KEY не е поставен на серверот"*,
re-run B3 then B4.

> Cost note: each scan is one Claude Vision call (Opus 4.8). Keep the key's spend
> limit sensible in the Anthropic console.

---

## C. Public deploy to GitHub Pages — *optional, only when you want it online*

While testing, you don't need this — just run locally (see
[`running-locally.md`](./running-locally.md)). When ready to publish:

1. **Turn on security in Supabase** (so the public URL is safe):
   - SQL Editor → run `supabase/rls.sql` (enables RLS + authenticated-only access
     on every table).
   - **Authentication → Users → Add user** — create the email + password you'll
     log in with (there is no public sign-up).
2. ~~**GitHub → repo Settings → Pages** → set **Source = "GitHub Actions"**.~~ ✅ done
3. ~~**GitHub → repo Settings → Secrets and variables → Actions** → add
   `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY`.~~ ✅ done
4. **Push to `main`** (or re-run the workflow). The site builds and appears at
   `https://dashwhiz.github.io/restaurant-admin/`.

Only **step 1 (RLS + login user)** is left before the public site is safe to use.

Full explanation: [`deploy.md`](./deploy.md) and [`security.md`](./security.md).

> The invoice scanner works the same on the deployed site — it already uses the
> Edge Function from section B, so nothing extra is needed for keys.

---

## D. Add the friend as a collaborator ✅ done

Added under GitHub → repo **Settings → Collaborators** — he can clone the repo,
run it locally, and let Claude Code make changes for him.

---

## Quick status

| Item | Where | Needed for | Done? |
|---|---|---|---|
| `pos_mappings` table | Supabase SQL Editor | POS import memory | ☐ |
| Supabase CLI installed | Friend's Mac | scanner deploy | ☐ |
| `link` project | terminal | scanner deploy | ☐ |
| `ANTHROPIC_API_KEY` secret | `supabase secrets set` | scanner | ☐ |
| Deploy `scan-invoice` | `supabase functions deploy` | scanner | ☐ |
| RLS + login user | Supabase | public deploy | ☐ |
