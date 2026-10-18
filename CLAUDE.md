@AGENTS.md

## Progress notes

Newest first. Keep each entry short: what changed, where it stands, what's next.

### 2026-10-18 — Event menu recipe search

- **Done:** in Настани → Мени (по гостин), the recipe dropdown is now a
  type-to-search box (`src/app/events/components/RecipePicker.tsx`, a copy of
  the imports picker without "Прескокни"). Arrow keys + Enter work.
- **Status:** build green; not clicked through by Claude (needs login). Inline
  review only.

### 2026-10-18 — POS import warnings

- **Done:** daily POS import (single day and multi-day) now shows yellow
  warnings above the import button and asks for confirmation before importing
  when (1) items have no recipe chosen — they'd be silently dropped — or (2) a
  matched recipe has no normativ, so the sale is saved but no stock is deducted.
  (2) only shows when "Одземи од залиха" is ticked. Items set to "Прескокни"
  don't warn. Shared box: `src/app/imports/components/ImportWarning.tsx`;
  `recipesWithIngredients()` in `recipes.ts`.
- **Data:** 83 of 770 recipes have no normativ; only "Пржен" has been sold so
  far (already imported without deducting stock). Owner told to add its
  ingredients if it should deduct.
- **Shipped:** `b52dc15`, `13ca651`. Build green; not clicked through by Claude
  (needs login). Owner will see it on the next POS import. Review was inline.

### 2026-10-18 — Product history window

- **Done:** clicking a product name on Производи or Залиха / Попис opens
  "Историја": deliveries, sales (incl. POS), waste, counts, completed events
  and stock resets for that product. It has type filters, a period selector
  (7/30/90 days/all) and per-type totals. Service: `src/lib/services/history.ts`.
- **Resets are now logged:** new table `stock_adjustments` (RLS on, added to
  `rls.sql`, backups, health, clean-up). "Нулирај залиха" writes one row per
  zeroed product. Earlier resets (incl. 2026-10-17) were never recorded.
- **Known limits:** sale/event amounts use today's recipe. POS days imported
  without "deduct stock" still show as sales. No running balance on purpose.
- **Verified:** build green; a hand-run SQL timeline for Павлака (count 3 −
  0.231 − 0.6) matches its stock of 2.169. Owner confirmed on the live site
  that Павлака's history shows. Review was inline, not the full review.
- **Shipped:** `ab548d7` (reset log), `bf54ec8` (history window).
- **Next:** owner keeps reporting from the restaurant; scan paste-JSON test
  (2026-10-07) still unconfirmed.

### 2026-10-17 — Stock clean-up, Залиха / Попис page, minimums

- **Reset stock:** the owner cleared all history in Поставки and stock stayed.
  The "Исчисти по секција" buttons delete rows only and never touch stock, by
  design. Added a "Нулирај залиха" button (`resetAllStock` in
  `src/lib/services/stock.ts`) and a note saying clearing doesn't change stock.
  The 12 leftover products were zeroed directly in the DB.
- **Залиха / Попис:** the owner asked for a "Залиха" page. Instead of a duplicate,
  Попис was renamed "Залиха / Попис" and moved under Каталог next to Производи
  (he couldn't find it under Анализи). Added filters: Сите залихи / Само со
  залиха / Само негативни.
- **Count date:** a "Датум на попис" field (defaults to today, no future dates).
  Backdated counts stamp `stocktake_log.created_at` at midday UTC; stock is
  still set to the count immediately.
- **Minimums:** the dashboard and Листа за нарачка showed nothing because every
  product had `min_stock = 0` ("don't track"). Added a "Минимум" column on
  Залиха / Попис that saves in bulk (`setMinStocks` in `products.ts`).
- **Data state (end of day):** owner did a full stocktake (40 products, dated
  2026-10-17) and set minimums on 46 products; 9 show as low on the dashboard.
  Purchases/sales/waste/POS/events history is empty — a clean start.
- **Tooling:** GitHub CLI (`gh`) installed via winget, but the owner hasn't
  logged in yet (`gh auth login --web` after a VS Code restart).
- **Shipped:** commits `2b661bc`…`f0102d2`, all deployed. None of it was
  clicked through in the app by Claude (needs the owner's login); the build
  passes and the DB checks above confirm the saved data.
- **Next:** owner keeps reporting bugs from the restaurant; the scan paste-JSON
  test (2026-10-07) is still unconfirmed.

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
