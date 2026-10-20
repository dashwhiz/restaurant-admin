@AGENTS.md

## Progress notes

Newest first. Keep each entry short: what changed, where it stands, what's next.

### 2026-10-20 — Sales keep the till's amount

- **Why:** turnover was quantity × recipe price, so till discounts made it
  differ (19.10: 26250 vs 25895). Owner asked to store the till amount.
- **Done:** new column `sales.amount` (with VAT, nullable). POS import saves
  each line's amount (gratis rows 0); `saleAmount()` in `sales.ts` = amount,
  else qty × price — used by Продажби (day total, CSV, price per portion) and
  Аналитика (revenue, trend, per-recipe/ABC). Editing a sale scales the amount
  to the new quantity; changing its recipe drops it.
- **DB backfill (17–19.10)** from the TXT files, split per recipe by quantity;
  17.10 Пелистерка's 1500 went to Кнјаз Милос (deliberate swap). All three
  days now equal the till: 99421 / 47045 (37395 + 9650) / 133315
  (25895 + 107420).
- **Status:** build green; inline review only. Not clicked through.

### 2026-10-20 — Events count in turnover (Продажби + Аналитика)

- **Why:** owner wants special orders in Продажби so they count in turnover.
  Till check 19.10: VKUPEN PROMET 133315 = sales 25895 + шанк 43200 + кујна
  64220 (the 41155 at the bottom is gratis/discount value, not the total).
- **Done:** the event is the one record (no duplicate sale). Every dated event
  — any type, since the owner renames them and switches type to Прослава — is
  listed in Продажби under its day ("Настани" section, read-only, links to
  Настани) and adds guests × price to the day total and CSV. Аналитика adds it
  to Приход (sub-line "… настани"), net revenue, the 6-month trend, and a
  completed event's menu cost to COGS. VAT by `eventVatRate(type)`.
  `listDatedEvents` / `eventAmount` in `events.ts`.
- **Data:** owner meanwhile renamed 18.10 → "Експириенс Балкан", 19.10 кујна →
  "Спец.нарачка-кујна Мекици" (type Прослава) and DELETED the 19.10 шанк event
  (43200) — asked whether on purpose.
- **Open bar (owner's practice):** drinks are rung on a separate table (e.g.
  305/1) and given out as GRATIS — stock/cost come in with the gratis sales.
  The guest then pays a "Спец.нарачка-шанк" line = the money only. So the
  owner had deleted the шанк event. Now the import makes шанк lines an
  `Open bar` event: no menu, `done` from the start, 18% (`eventVatRate`), note
  "open bar, пијалокот е во гратис". Type also selectable in EventDialog.
  POS dedup is now by name + date, any type. 19.10 шанк not re-added yet
  (asked the owner).
- **Status:** build green; inline review only (not the full review).

### 2026-10-20 — Special orders go to Настани on import

- **Bug:** special orders reached Настани only via a separate "Префрли во
  Настани" button; clicking just Увези skipped them silently (19.10).
- **Fix:** single-day and multi-day POS imports now create the events
  themselves after the sales (`importSpecials` in `SpecialOrders.tsx`; an
  event failure is reported, not thrown, so the day isn't re-imported). The
  purple box is now just a notice. Single-day: only lines left on Прескокни.
- **DB (owner asked):** 19.10 events added — Спец.нарачка-шанк 1 × 43200,
  Спец.нарачка-кујна 3 × 21406.67 (64220 total), both planned. Owner fills the
  menus, then completes them.
- **Then (owner):** the till quantity is not the guest count — he enters guests
  himself. `createEventsFromPos` now makes 1 guest × the full till amount, note
  says "внеси гости рачно". 19.10 кујна changed to 1 × 64220.
- **Status:** build green; inline review only.

### 2026-10-20 — Delivery: change the product

- **Why:** owner entered Ајдамер instead of Кашкавал and the edit form had the
  product locked.
- **Done:** product is editable when editing a delivery. `updateDelivery` takes
  the old quantity off the old product, adds the new quantity to the new one,
  and refreshes cost/VAT on both. Invoice VAT rate kept on swap.
- **Status:** build green; inline review only; owner to fix today's delivery
  himself (Испорака → Измени → Кашкавал).

### 2026-10-20 — Control correction on Залиха / Попис

- **Why:** open-bar groups — waiters don't write down every drink, so a few
  articles drift. Owner wants to add/subtract on top of the system stock for
  just those, not count them (Избројано stays as it was).
- **Done:** new column "Корекција +/−" (`submitCorrections` in
  `stocktake.ts`, via `applyLoggedStockDeltas`, reason `Контролен попис`, shows
  in Историја). A row takes a count or a correction, not both. It's a delta, so
  the normativ-correction cutoff ignores it. Corrections apply now; the
  "Датум на попис" only dates counts.
- **Status:** build green; inline review only; not clicked through (needs login).

### 2026-10-19 — Normativ change corrects past stock

- **Done (owner asked):** changing a recipe's normativ now recomputes stock
  already taken by its past sales/completed events: per product
  −(new − old per portion) × portions, only for portions that took stock after
  the product's stock was last set outright (count, Нулирај, hand edit).
  Service `src/lib/services/normativ.ts`; applied via `applyLoggedStockDeltas`
  (stock.ts), logged as `Норматив сменет: …` (Историја shows it with 0, since
  sale lines already use today's recipe). Recipe dialog shows the list and asks
  "Зачувај и поправи залиха" / "Само зачувај"; normativi import has a checkbox
  (on). Rules written up in `docs/features/stock.md`.
- **DB (live):** `sales.inserted_at` + `sales.stock_deducted`,
  `stocktake_log.inserted_at`, `events.completed_at` — the cutoff compares when
  stock really moved, not the business day. Old rows backfilled from
  `created_at`. Today's manual Мелено Месо / Кртина rows renamed to the
  `Норматив сменет:` prefix.
- **Side fixes from the review:** sales imported without deducting no longer
  move stock on edit/delete; counts equal to the system are logged; a hand edit
  of Тековна залиха is logged; the product form no longer resends a stale stock
  value when only price/notes change (it used to undo sales made meanwhile).
- **Review:** full review by a subagent (1 critical — the same correction could
  be applied twice on reopening the dialog — and 4 important, all fixed),
  re-reviewed: OK. Build green. Checked against data: Плескавица 0.22→0.25 gives
  −0.72 kg Мелено Месо (24 portions after the 17.10 count). Not clicked through
  (needs login).

### 2026-10-19 — Summary so far

What was done today (details in the entries below):
- **POS gratis:** the daily TXT is now read by column, so GRATIS/Pansion
  portions are no longer lost. They're saved as sales marked `is_gratis`:
  stock + cost, no revenue ("Гратис" badge in Продажби, gratis cost in
  Аналитика). Same fix recovered lines the old parser dropped ("Pnn" flag,
  page breaks).
- **17.10 and 18.10 reconciled** with the till files (18.10 re-exported by the
  owner): both days now match to the denar; gratis and missing lines added,
  stock deducted. 17.10 Пелистерка-as-Кнјаз is deliberate.
- **Duplicate guard:** single-day POS import warns if the day is already in.
- **Мелено Месо:** stock fixed to 5.67 (normativ had been changed after the
  imports); both Кртина back to 0. Owner confirmed it shows.
- **Special orders:** abbreviated "Спец.нарачка-кујна/шанк" now recognised;
  18.10 order moved from a sale to an event in Настани.
- **Delivery form:** prices with/without VAT now fill each other in and follow
  the VAT % (closes the 2026-10-18 open item); a hand-entered delivery now sets
  the product's cost. Лепинја delivery fixed to 11.43 / 12.00 at 5%.
- **Normativ change → stock:** changing a recipe's normativ (dialog or
  normativi import) now corrects stock already taken by past sales/events
  after each product's last count, with a preview and a "Само зачувај" option.
  Full review + re-review done. New DB columns: `sales.inserted_at`,
  `sales.stock_deducted`, `stocktake_log.inserted_at`, `events.completed_at`.
  Side fixes: equal counts and hand stock edits are logged; the product form no
  longer resends a stale stock value.

Open:
- **Normativ change → auto stock correction:** done (see entry above); owner
  to try it on the next normativ change.
- **Event 18.10 "Спец.нарачка-кујна":** owner fills in the menu, then completes it.
- Small drifts (Лозова Жолта, Сирење Биено, Гордон, Бовин) and big negatives
  (Јајца, Зејтин, Тиквици, Шеќер кесички) → next stocktake.
- Still open from before: Домат-сув reminder, šifrarnik unitless lines, scan
  paste-JSON test.

### 2026-10-19 — Delivery form prices (Лепинја)

- **Bug:** the delivery form's "без ДДВ", "ДДВ %" and "со ДДВ" were three
  unlinked fields, so Лепинја was saved as 10.56 / 12.00 at 5% (should be
  11.43). And a hand-entered delivery never set the product's cost — Лепинја
  stayed at 0 ден (only scans set it).
- **Fix:** `DeliveryDialog` — typing either price fills the other; changing
  the rate keeps the price with VAT and recomputes the one without.
  `refreshFromLatestDelivery` (was `refreshVatRate`) now also sets
  `products.cost_per_unit` from the latest delivery with a cost > 0, on
  create/edit/delete.
- **DB:** that delivery and the product corrected to 11.43 (only delivery in
  the DB with mismatched prices). Not clicked through (needs login).
- Nothing today was clicked through by Claude (needs login).

### 2026-10-19 — Abbreviated special orders

- **Bug:** the till writes "SPEC.NARA^KA-kujna" (→ "Спец.нарачка-кујна");
  `isSpecialOrder` only knew the full "специјална нарачка", so on 18.10 it was
  imported as a sale of a 0-price, no-normativ recipe and no event was offered.
- **Fix:** `isSpecialOrder` (`src/lib/pos/match.ts`) also matches "спец." /
  "spec." forms; "Специјалитет Лира" still doesn't match.
- **DB:** 18.10 sale deleted (no stock/revenue effect), event "Спец.нарачка-
  кујна" 18.10 created (planned, 1 × 9650), šifra 609999 mapping → skip.
  Owner fills its menu in Настани; stock moves when it's completed.
- **Pending owner answer:** auto-correct stock when a normativ changes
  (proposed: preview + confirm, only sales after each product's last count;
  same for normativi import). Not started.

### 2026-10-19 — Мелено Месо stock

- **Cause:** Плескавица / Шарска Плескавица normativ was changed to
  Мелено Месо (0.22 / 0.2 kg) AFTER the 17.10 and 18.10 imports. Those sales
  had deducted Јунешка + Свинска Кртина (−4.24 each, never bought/counted), and
  Мелено Месо stayed at its 17.10 count of 14.35. Editing a normativ never
  re-applies past sales — by design.
- **DB (owner asked to update):** Мелено Месо 14.35 → 5.67, both Кртина → 0,
  each logged in `stock_adjustments` (shows in Историја).
- **Smaller drifts from the same cause** (found by recomputing count + buys −
  waste − sales): Лозова Жолта −4.4 L, Сирење Биено +0.4, Гордон Амбер −0.15,
  Бовин −0.12. Not touched; next stocktake fixes them.

### 2026-10-19 — POS import: gratis column

- **Bug:** the daily TXT parser took "the first two decimal numbers" on a
  line. GRATIS/Pansion quantities print without decimals ("11"), so every free
  portion was ignored and stock stayed too high. It also dropped lines ending in
  the "Pnn" flag (18.10: Пилешки Увијач 3, one Тиквици Похувани).
- **Fix:** `parseDaily` now reads by column position (from the file's own
  `--- ------` ruler). Items carry `gratis` (GRATIS + Pansion). The import saves
  free portions as a separate sale with new column `sales.is_gratis` (note
  `POS <date> · гратис`): deducts stock, counts in cost, revenue 0. Sales page
  shows a "Гратис" badge; Аналитика shows the gratis cost under Кост на
  продадено and leaves it out of revenue, units sold and ABC.
- **Data:** 18.10 corrected in the DB (owner OK): gratis Скопско 0.5 11,
  Колбас 1, Еспресо 16 + missing Тиквици 1, Пилешки Увијач 3; stock deducted;
  šifra 601648 mapped. Paid total now 47045 ден = the till's tariff totals.
- **17.10 corrected too** (file back in Documents, total 99421 ден = till):
  gratis Скопско 0.5 3; Тиквици Похувани +12 (old parser dropped a line ending
  in a form-feed page break). Stock deducted.
- **Deliberate, leave it:** on 17.10 the 10 Пелистерка 0.750 are saved as
  Кнјаз Милос (25 instead of 15). Owner confirmed it was on purpose — don't
  "fix" it in a future reconciliation.
- **18.10 re-exported by the owner** (the till had missed lines): same paid
  total, more gratis — added Скопско 0.33 3, Попов Наливно 9, Кока-кола 2,
  Природен Сок 0.2 2, Вешалица 1; mapped 220210 and 600520. 18.10 = 183.9 paid
  + 45 gratis, matching the new file. Gratis-only lines (sold 0.000) parse fine.
- **Duplicate guard:** single-day import now warns (box + confirm) when the
  day is already imported; bulk import already skipped such days.
- **Status:** both days now match the till. Not clicked through (needs login).

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
