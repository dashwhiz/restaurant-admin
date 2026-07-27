# Conventions

## Imports
- Use the `@/` alias across directories: `@/lib/...`, `@/components/...`.
- Relative imports (`./`) only **within** the same feature folder.

## File & symbol naming
| Thing | Convention | Example |
|---|---|---|
| Page | `page.tsx` (App Router) | `products/page.tsx` |
| React component | PascalCase `.tsx` | `ProductDialog.tsx` |
| Service (data access) | `<feature>.ts` | `services/products.ts` |
| Types | in `src/lib/types.ts` | `Product`, `Recipe` |
| Helpers | camelCase in `src/lib/format.ts` | `fmtMKD`, `num` |

## Components
- Feature-only components live in `src/app/<feature>/components/`.
- Reusable ones live in `src/components/` and must be presentational (no
  Supabase, no business logic).
- A page is `'use client'` because it loads data and holds state.

## Services
- One file per feature under `src/lib/services/`.
- Every exported function does one Supabase operation (or a small transaction).
- Throw on error (`if (error) throw error`); the page catches and shows a toast.
- Adapt database shapes to the UI inside the service, not in components.

## Styling
- Tailwind utilities. Shared patterns (`card`, `btn-primary`, `btn-ghost`,
  `btn-danger`, `input`, `label`) are defined in `globals.css`.
- Colors come from the theme tokens (`bg-surface`, `text-muted`, `bg-primary`,
  `text-danger`, …). **Never hardcode hex** — it breaks dark mode.
- Add `sm:`/`md:` variants for layout; don't build a separate mobile version.

## Text
- User-facing copy is Macedonian. Keep it inline for now (small app); if a
  string is reused a lot, factor it out.
- React escapes text by default — never use `dangerouslySetInnerHTML`.

## Types & lint
- `tsconfig` is strict. `npm run build` typechecks the whole project — a green
  build is the bar before calling something done.
- Prefix intentionally-unused vars with `_`.
