@AGENTS.md

## Progress notes

Newest first. Keep each entry short: what changed, where it stands, what's next.

### 2026-10-18 — End of day summary

What was done today (details in the entries below):
- **Настани:** recipe search box in the event menu.
- **POS import:** special orders default to Прескокни, can be sent to Настани
  from single- and multi-day imports, no duplicate events. Lines without a
  unit (Брускети) are no longer dropped.
- **Sales by weight:** `sales.quantity` is numeric; 17.10 lamb/ribs/knuckle
  and stock corrected; Брускети recipe created by owner and 17.10 sale added.
- **Products:** notes field ("Забелешка"); Тиквици unit fixed to kg.
- **Scan:** pack price divided per piece (app + edge function v5).
- **ДДВ switch** with per-product / per-recipe rates; margin always without
  VAT; 38 dishes moved from "Пијалок" to "Храна".
- **Чај Кесички, final:** the tea is **5%** VAT (owner), not 18%. All 4
  purchases and the product are now 3.62 ден without VAT / 3.80 with, 304 ден
  for 80 bags. Invoice 0092 totals 5223 ден with VAT in the app; the paper
  invoice says 5477 — the owner left some lines out on purpose, that's fine.

Open for next time:
- **Delivery form:** changing ДДВ % doesn't recalculate the prices (the
  scan review does). Offered to the owner, not asked for yet.
- **Домат-сув:** stock −4.05, never counted; remind at its first delivery
  (note on the product too).
- **Šifrarnik:** parser still skips lines without a unit; a re-import may
  move the 38 dishes back to "Пијалок". Need a sample file.
- **Not clicked through by Claude:** everything today needs login — the owner
  checks on the live site (Ctrl+Shift+R after a deploy).
- Scan paste-JSON test from 2026-10-07 still unconfirmed.

### 2026-10-18 — ДДВ switch (Без ДДВ / Со ДДВ)

- **Done:** a switch at the top of the sidebar (and in the mobile header)
  shows every price/cost with or without VAT; a yellow banner stays up while
  "Со ДДВ" is on. Remembered per browser (`lira-vat`). Helpers in
  `src/lib/vat.ts`, switch/hook in `src/components/layout/Vat.tsx`.
- **Profit, margin, food cost %, waste % are always without VAT** on both
  sides. Before this, margin compared cost without VAT to price with VAT and
  came out too high (Цени and Аналитика).
- **DB:** new `products.ddv_rate` (14 filled from their latest purchase; null
  → Кујна 5% / Бар 18%) and `recipes.ddv_rate` (food 10%; drinks 18%, except
  56 non-alcoholic ones set to 10% from the owner's menu at lyra-menu.fyi).
  Events: Кетеринг 5%, other types 10% (by type, no column). Deliveries and
  scans keep the product rate = latest delivery's rate (0% / unread ignored).
- **Data finding:** 38 dishes (Буковка, Вргањ, Лигњи, Шкампи, Сарма, Чварки,
  Шампињони, Похувани…) were filed under category "Пијалок". Set to 10%, and
  at the owner's request moved to category "Храна" in the DB (all 38 updated).
  A šifrarnik re-import could put them back under "Пијалок" — check then.
- **Review:** full code review run; fixed 0%-delivery rate, rate update
  failing after a saved delivery, scans overwriting rates with an unread 18%,
  product dialog not following department, ABC reshuffling on the switch,
  duplicate conversion, unlabeled CSVs/history. Skipped: double compute in
  analytics (small data), unmatched POS lines at 10% (`pos_sales_items` empty).
- **Status:** build green; not clicked through (needs login). Tea checked in
  SQL: cost 3.22 / 3.80, price 90.91 / 100, margin 96% both ways.

### 2026-10-18 — Scan: pack price per piece

- **Bug:** invoice 0092 had 4 × 1 pack of 20 tea bags at 76 ден. The scan
  turned each pack into 20 pieces but kept the pack price, so Чај Кесички cost
  64.41/bag and "Ч А Ј" showed 64 ден in Аналитика.
- **Fix:** prompt rule now says to divide the pack price by the piece count
  (`scan.ts` + edge function, deployed as v5). DB corrected with owner's OK:
  4 purchases and the product now 3.22 ден without VAT (304 ден total with VAT).
- **Watch:** on the same invoice, Тиквици are "piece" with qty 1.380 — looks
  like kg; owner told. Not tested on a new invoice yet.

### 2026-10-18 — Product notes

- **Done:** new nullable column `products.notes` (added live; same table, so
  RLS/backups unchanged). Editable as "Забелешка" in the product dialog, shown
  in small grey text under the name on Производи and Залиха / Попис.
  Домат-сув already carries its reminder note.
- **Status:** build green; not clicked through (needs login). Inline review.

### 2026-10-18 — Sales by weight, unitless POS lines

- **Bug:** `sales.quantity` was `integer` and `importDaily` did `Math.round`,
  so dishes sold by KGR were saved as whole numbers (Јагнешко печење 0.400 →
  1, Св.ребра 3.300 → 3, Свин. кол. 0.700 → 1) and stock deducted wrongly.
- **DB (done live, owner approved):** `sales.quantity` is now `numeric`. The 3
  sales of 2026-10-17 were corrected and the ingredient difference applied to
  stock (e.g. Јагнешко Месо +0.96 kg).
- **Code:** import keeps 3 decimals; manual sale form accepts decimals; the
  daily parser now reads lines with no unit (БРУСКЕТИ was silently dropped).
- **Брускети:** owner created the recipe (180 ден; Домат-сув 2 piece, Сирење
  0.1 kg, Леб 0.2 kg). The 2 sold on 2026-10-17 were added directly in the DB
  with stock deducted, and POS šifra 601005 mapped to it. The šifrarnik parser
  still skips unitless lines (no sample file to test against).
- **REMINDER — Домат-сув:** stock is −4.05 piece because it was never counted.
  Owner chose to leave it for now. When the first Домат-сув delivery is
  entered, remind the owner to check its unit (piece vs kg) and the amount in
  Брускети + its 2 other recipes, and to set the real stock.
- **Status:** build green; parser checked against `Documents\17.10.26.TXT`
  (75 items, Брускети included). Not clicked through. Inline review only.

### 2026-10-18 — POS special orders → events

- **Done:** "специјална нарачка" lines in a POS import now (1) default to
  Прескокни in single-day and are always left out of sales in multi-day, so
  stock isn't deducted twice (once as a sale, again when the event is
  completed); (2) are offered as events in the multi-day import too; (3) can't
  create duplicates — `createEventsFromPos` in `events.ts` skips an event with
  the same name + date + type, and the button locks after use. Shared box:
  `src/app/imports/components/SpecialOrders.tsx`.
- **Status:** build green; not clicked through by Claude (needs login). Inline
  review only.

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
