@AGENTS.md

## Progress notes

Newest first. Keep each entry short: what changed, where it stands, what's next.

### 2026-10-17 — Settings: reset stock (Нулирај залиха)

- **Problem:** the owner cleared all history in Поставки and stock stayed. The
  "Исчисти по секција" buttons delete rows only and never touch stock, by design.
- **Done:** added a "Нулирај залиха" button (`resetAllStock` in
  `src/lib/services/stock.ts`) plus a note saying clearing doesn't change stock.
  The 12 leftover products were zeroed directly in the DB on 2026-10-17.
- **Next:** owner checks the button after deploy.

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
- **Setup:** the owner's working copy is now a real `git clone` at
  `C:\Users\BerdynaTech\Projects\restaurant-admin`. The old
  `Downloads\restaurant-admin-main` folder was a ZIP download with no `.git` —
  don't work there.
