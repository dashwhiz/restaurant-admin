# Architecture

A small, client-side Next.js app. The browser talks directly to Supabase; there
is no custom backend. This mirrors the old HTML app, keeps the code simple, and
means the whole thing can be shipped as a **static export** later.

## The one pattern: a feature is a vertical slice

Every feature is wired the same way. Learn it once and every feature looks the same.

```
src/app/<feature>/page.tsx          'use client' — loads data, holds UI state, renders
  │
  ├─ src/lib/services/<feature>.ts  ALL Supabase queries for the feature
  │     └─ getSupabase()            the one shared client (src/lib/supabase.ts)
  │
  ├─ src/app/<feature>/components/   UI used only by this feature (dialogs, rows)
  │
  ├─ src/components/                 shared UI (Modal, Badge, PageHeader, Toast, Icons)
  ├─ src/lib/types.ts                database row types
  └─ src/lib/format.ts              money/date/number helpers
```

**Rule:** components never call `getSupabase()`. They call service functions.
The service is the only place that knows about the database.

## Layers

| Layer | Where | Responsibility |
|---|---|---|
| Page | `src/app/<feature>/page.tsx` | Load data via services, hold local state, render |
| Feature components | `src/app/<feature>/components/*` | Dialogs, rows, forms for that feature only |
| Shared UI | `src/components/*` | Reusable presentational pieces, no data access |
| Services | `src/lib/services/*` | Every Supabase query; adapt DB shapes to the UI |
| Client | `src/lib/supabase.ts` | The single Supabase client + config check |
| Types | `src/lib/types.ts` | Row types mirroring the DB |
| Helpers | `src/lib/format.ts` | Pure formatting/util functions |

## Data flow

1. A page mounts and calls a service function in a `useEffect`.
2. The service runs a Supabase query and returns typed rows.
3. The page stores them in React state and renders.
4. A mutation (add/edit/delete) calls a service function, then re-loads.

No global store, no data-fetching library. If a piece of data is needed by two
pages, each loads it through the same service — that's fine and simpler than
shared caches.

## Why client-side (and the trade-off)

Pro: dead simple, no server to run, static-export/GitHub-Pages capable.

Con: the Supabase anon key is in the browser. Safe for **local** use. For a
public deploy we must add auth + enable Row-Level Security first — see
[`security.md`](./security.md). This is why we avoid server-only Next features
(API routes, server actions): they'd break static export.

## Stock is the delicate part

`current_stock` on a product is a running total changed by deliveries, sales,
waste, POS imports and events. Every change must be **exactly reversible** so
edits and deletes don't cause drift. All stock changes go through one place —
see [`features/stock.md`](./features/stock.md).
