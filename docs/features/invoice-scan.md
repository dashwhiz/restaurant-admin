# Invoice scanning (Скенирај фактура)

Take a photo of a supplier invoice, fiscal receipt, or delivery note
(фактура / фискална сметка / испратница) and let Claude read the line items for
you. You check them, then import — each item adds stock and records a purchase.

Page: `/scan` · Service: `src/lib/services/scan.ts` ·
Server function: `supabase/functions/scan-invoice`

## Why there's a server function

Reading the image needs the **Anthropic API key**. That key must **never** be in
the browser (anyone could copy it and spend your money). So the browser sends the
image to a small **Supabase Edge Function** that holds the key and talks to Claude
for us. The browser never sees the key.

```
Browser (/scan page)
  → sends the photo (base64) to the Edge Function "scan-invoice"
      → Edge Function adds the secret key, calls Claude Vision
      ← returns clean JSON: supplier, invoice number, date, and line items
  ← the page shows a review table
```

## The flow, step by step

1. **Pick or snap a photo** (JPG/PNG) or a PDF on the `/scan` page.
2. The page uploads it to the Edge Function and shows "reading…".
3. Claude returns the supplier, invoice number/date, and every product line with:
   quantity, unit, price **без ДДВ**, ДДВ %, price **со ДДВ**.
4. **Review table** — one row per line. For each row you can fix the quantity,
   unit, prices, and choose what it maps to:
   - a **matching existing product** (auto-guessed by name; a green badge shows
     the match and confidence %),
   - **+ Нов производ** — create a new product from this line,
   - **Прескокни** — ignore this line.
   Editing the base price or the ДДВ % **auto-fills** the "со ДДВ" price
   (base × (1 + rate/100)) — you can still override it.
5. **Увези во залиха** — for every non-skipped line with a quantity:
   - matched product → its stock goes up by the quantity, and its
     `cost_per_unit` is refreshed to the base (без ДДВ) price;
   - new product → created with that stock and cost;
   - a **purchase** row is logged (supplier + "Фактура <бр> · Скенирање").

Stock is changed through the shared `applyStockDelta` helper, so a delivery/edit
stays reversible (same rule as everywhere — see [`stock.md`](./stock.md)).

## Prices and VAT

- `cost_per_unit` stores the **base (без ДДВ)** unit price — that's the real cost.
- `ddv_rate` and `price_with_ddv` are kept on the purchase for reference.
- Prices are **per single unit**, not line totals. A fiscal receipt's prices
  include VAT (Claude fills "со ДДВ"); an invoice usually lists без-ДДВ prices.

## New products get sensible defaults

A line imported as a new product is created as category **Суровина**, department
**Кујна**, `min_stock` 0. Adjust it afterwards on the Products page if needed.

## Setup — done (2026-07-27)

The `scan-invoice` Edge Function is deployed and `ANTHROPIC_API_KEY` is set as a
server secret, so the scanner works on both the local and deployed app. Commands
and redeploy notes: [`../deploy.md`](../deploy.md#invoice-scanner).

If the page ever shows *"ANTHROPIC_API_KEY не е поставен на серверот"*, the
secret is missing or misnamed — check **Edge Functions → Secrets** in the
dashboard, then redeploy the function.

## Cost

Each scan is one Claude Vision call. Keep a sensible spend limit on the key in
the Anthropic console.
