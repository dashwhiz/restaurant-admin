---
name: lira-add-feature
description: Use when adding or extending a feature in this Lira inventory app (a new page/section, a new kind of record, or a new screen). Establishes the required vertical-slice pattern so every feature stays consistent.
---

# Adding a feature — follow the vertical-slice pattern

Copy the **products** feature; it's the reference. Do it in this order:

1. **Plan** (non-trivial only): `superpowers:brainstorming`, then write a short
   plain-language spec to `docs/features/<feature>.md`.
2. **Type** in `src/lib/types.ts` (match DB columns).
3. **Service** `src/lib/services/<feature>.ts` — ALL Supabase queries, one
   function per operation, throw on error. Components never call `getSupabase()`.
4. **Page** `src/app/<feature>/page.tsx` (`'use client'`) — load via the
   service, hold state, render with `PageHeader` + shared UI + a dialog.
5. **Feature components** in `src/app/<feature>/components/`.
6. **Nav** — add/confirm the route in `src/components/layout/nav.ts`.
7. **Verify** — `npm run build` green AND click through it in `npm run dev`.
   Big feature → full `superpowers:requesting-code-review`; small → inline (say so).

Rules: `@/` alias across dirs; theme color tokens only (no hex); if it touches
stock, use the `lira-stock` skill. Full playbook: `docs/adding-a-feature.md`.
