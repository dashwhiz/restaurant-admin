@AGENTS.md

## Progress notes

Newest first. Keep each entry short: what changed, where it stands, what's next.

### 2026-10-06 — Invoice scan: paste JSON (Залепи JSON)

- **Done:** `/scan` can now take JSON pasted from a normal Claude chat instead
  of calling the API. "Копирај промпт" copies the prompt; the owner attaches
  the invoice photo in Claude, pastes the reply, clicks "Прочитај", and it goes
  through the usual review → import flow. Spec:
  [`docs/features/invoice-scan.md`](./docs/features/invoice-scan.md).
- **Shipped:** commit `eb2e697`, deployed to GitHub Pages.
- **Next:** owner tests it on real invoices in the restaurant (2026-10-07).
  Fix whatever comes up — likely prompt tweaks or unit/price parsing.
- **Watch out:** `SCAN_PROMPT` in `src/lib/services/scan.ts` must stay in sync
  with the prompt in `supabase/functions/scan-invoice/index.ts`.
- **Setup gotcha:** the owner's copy in `Downloads\restaurant-admin-main` was a
  ZIP download with no `.git`, so it couldn't commit or push. Work from a real
  `git clone` of this repo.
