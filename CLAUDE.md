@AGENTS.md

## Progress notes

Newest first. Keep each entry short: what changed, where it stands, what's next.

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
