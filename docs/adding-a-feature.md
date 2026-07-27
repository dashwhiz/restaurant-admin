# Adding a feature (playbook)

Every feature is a vertical slice. Copy the **products** feature — it's the
reference. Steps:

## 1. Plan (for anything non-trivial)
Use `superpowers:brainstorming` and write a short, plain-language spec to
`docs/features/<feature>.md`: what it does, the screens, the data it reads/writes,
and any stock effects.

## 2. Types
Add/confirm the row type in `src/lib/types.ts` (match the DB column names).

## 3. Service — `src/lib/services/<feature>.ts`
All Supabase queries. One function per operation. Throw on error. Example shape:

```ts
import { getSupabase } from '@/lib/supabase';
import type { Thing } from '@/lib/types';

export async function listThings(): Promise<Thing[]> {
  const { data, error } = await getSupabase().from('things').select('*').order('name');
  if (error) throw error;
  return (data ?? []) as Thing[];
}
export async function createThing(input: Omit<Thing, 'id' | 'created_at'>) { /* ... */ }
export async function updateThing(id: string, input: Partial<...>) { /* ... */ }
export async function deleteThing(id: string) { /* ... */ }
```

If the feature changes stock, use the shared stock helpers — see
[`features/stock.md`](./features/stock.md). Never write `current_stock` ad-hoc.

## 4. Page — `src/app/<feature>/page.tsx`
`'use client'`. Load via the service in `useEffect`, hold rows + search + dialog
state, render with `PageHeader`, the shared table/card markup, and a dialog.
Use `useToast()` for feedback.

## 5. Feature components — `src/app/<feature>/components/`
The add/edit dialog (copy `ProductDialog.tsx`), rows, etc.

## 6. Navigation
The route already exists in `src/components/layout/nav.ts`. If it's a new one,
add it there.

## 7. Verify
`npm run build` green **and** click through the flow in `npm run dev`. Use the
`verify` skill. Then, for a big feature, run the full
`superpowers:requesting-code-review`.
