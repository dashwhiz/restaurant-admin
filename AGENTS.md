<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# AGENTS.md

Guidance for AI agents (Claude Code) and humans working in this repository.
This is the canonical contributor/agent doc — `CLAUDE.md` just points here.

New here? Read [`README.md`](./README.md) for setup, then the deeper docs in
[`docs/`](./docs):

- [`docs/architecture.md`](./docs/architecture.md) — how the pieces fit together
- [`docs/conventions.md`](./docs/conventions.md) — naming, imports, file layout
- [`docs/data-model.md`](./docs/data-model.md) — the Supabase tables
- [`docs/adding-a-feature.md`](./docs/adding-a-feature.md) — step-by-step playbook
- [`docs/debugging.md`](./docs/debugging.md) — how to find out why something broke
- [`docs/security.md`](./docs/security.md) — dependency policy, hosting, RLS
- [`docs/features/`](./docs/features) — one plain-language spec per feature

## Who this is for

The owner is **not a professional developer**. He runs this in VS Code and asks
Claude Code to make changes. So:

- **Explain what you're doing in plain language.** Specs and plans should be
  understandable by a non-developer. Avoid jargon where a normal word works.
- **Follow good engineering practice anyway** — clean, small, reusable code.
  This may be sold one day; keep it tidy and framework-idiomatic.
- **Keep it simple.** Prefer the boring, obvious solution. Don't add
  abstractions, patterns, or libraries that aren't needed yet (YAGNI).

## What this is

A restaurant inventory + sales tool for a Macedonian gostilnica ("Lira"). It
tracks products (stock), recipes (what's sold), deliveries, sales, waste,
catering events, and imports the restaurant's POS exports (šifrarnik, normativi,
cenovnik, daily sold-items) and scanned invoices.

It is a **rewrite** of an 8000-line single-file HTML app (the owner keeps that
original file outside this repo; it's the reference for *what features should
do*). This rewrite reuses the **exact same Supabase database** — no data
migration.

## Running it

```bash
npm install
npm run dev      # http://localhost:3000
npm run build    # production build — this is also the real typecheck
npm run lint     # eslint
```

Setup and a non-technical walkthrough: [`README.md`](./README.md) and
[`docs/running-locally.md`](./docs/running-locally.md). You must create
`.env.local` (copy `.env.local.example`) with the two Supabase values, or the
app shows a "not configured" screen.

There is **no test suite.** Verify changes with `npm run build` (it typechecks
everything) **and** by exercising the change in the running app.

## Architecture at a glance

Client-side app: the browser talks directly to Supabase. One feature → one
vertical slice, wired the same way every time:

```
src/app/<feature>/page.tsx        # 'use client' page: loads data, renders UI
  └─ calls a service   src/lib/services/<feature>.ts   # ALL Supabase queries
       └─ getSupabase() from src/lib/supabase.ts
  └─ renders components src/app/<feature>/components/*  # feature-local UI
  └─ shared UI from     src/components/*                # Card, Badge, Modal, …
  └─ types from         src/lib/types.ts                # DB row types
  └─ helpers from       src/lib/format.ts               # money/date formatting
```

Why client-side: it mirrors the old app, keeps the code simple, and stays
deployable as a **static export** (GitHub Pages) later. Full detail in
[`docs/architecture.md`](./docs/architecture.md).

## Rules

**DO**

- Follow the per-feature slice: `service → page → components`. Copy the shape of
  an existing feature (start from `products`).
- Route **every** Supabase call through a service in `src/lib/services/`. Never
  call `getSupabase()` from a component.
- Use the `@/` import alias across directories (`@/lib/...`, `@/components/...`).
  Relative imports only within the same feature folder.
- Keep stock changes **exactly reversible** — edits/deletes must undo the
  original stock effect. See [`docs/features/stock.md`](./docs/features/stock.md);
  this was the #1 bug source in the old app.
- Make layouts fluid and add `sm:`/`md:` where useful — mobile is nearly free
  with Tailwind; don't build a separate mobile layout.

**DON'T**

- Don't add a state-management, data-fetching, CSS-in-JS, or component library.
  The stack is intentionally **Next.js + React + Tailwind + supabase-js** — nothing more.
- Don't put Supabase queries or business logic in components.
- Don't use `dangerouslySetInnerHTML`.
- Don't add server-only Next features (API routes, server actions, server-side
  data rendering) — they break static export. Keep data access in the browser.
- Don't install a package without running the security check below first.

## Dependency & security policy

**Before installing ANY npm package**, check the *specific version* online for
supply-chain / malware issues:

1. Web-search `"<package> npm malware OR compromised OR advisory 2026"`; check the
   npm advisory / Snyk / socket.dev result.
2. Confirm it's the **official** package (typosquats exist — `supabase-javascript`
   is malware; the real one is `@supabase/supabase-js`).
3. Prefer a pinned, patched version; note why it was added in the commit.
4. Run `npm audit`. Runtime (`npm audit --omit=dev`) must be clean; accept
   dev-only advisories only if noted in [`docs/security.md`](./docs/security.md).

Keep the dependency count as low as possible.

## Working on features

### Before a substantial feature
- Use `superpowers:brainstorming` to align on the approach and write a short,
  plain-language spec into `docs/features/<feature>.md` before writing code.
  Small, obvious changes don't need it.

### Verification (before claiming anything is done)
- `npm run build` green (typechecks the whole project).
- Actually exercise the change in `npm run dev` — use the `verify` skill to drive
  the flow where possible. If it needs real data you can't reach, say exactly
  what to click and ask the owner to check.
- Use `superpowers:verification-before-completion` before saying "done/fixed".
  Report real output — never claim a check that didn't run.

### Code review
- **After a big feature** (new page/flow, shared code in `src/components` or
  `src/lib`, anything touching stock math): run the **full**
  `superpowers:requesting-code-review` methodology (dispatch its subagents), then
  a human reviews before merge.
- **Small, isolated changes:** an inline review is fine — but say explicitly that
  it was inline, not the full review.
- Acting on review feedback: use `superpowers:receiving-code-review`.

### Debugging
- Use `superpowers:systematic-debugging` for any non-obvious bug: reproduce,
  find root cause, then fix — don't patch symptoms. App-specific tactics are in
  [`docs/debugging.md`](./docs/debugging.md).

## Suggested plugins/skills for this repo

Install the **superpowers** plugin in Claude Code so the skills above are
available (`brainstorming`, `writing-plans`, `systematic-debugging`,
`requesting-code-review`, `receiving-code-review`, `verification-before-completion`,
`verify`). See [`docs/running-locally.md`](./docs/running-locally.md#claude-code-setup).

## Known constraints (not bugs to "fix")

- **Supabase RLS is currently disabled** and the anon key is public. Acceptable
  for **local** use only. Before any public deploy, add a login + enable RLS —
  see [`docs/security.md`](./docs/security.md).
- **Negative stock is allowed on purpose** — a real "you sold more than the
  system knew" signal, and it keeps edits/deletes exactly reversible.
- **9 dev-only npm advisories** (ESLint/PostCSS tooling) are accepted; they never
  ship. Runtime deps are clean. See [`docs/security.md`](./docs/security.md).
