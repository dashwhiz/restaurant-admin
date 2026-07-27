# Running locally

Full non-technical steps are in [`../README.md`](../README.md). This page adds
the Claude Code setup and a few tips.

## Quick start

```bash
npm install            # once
cp .env.local.example .env.local   # once (already done on the owner's machine)
npm run dev            # then open http://localhost:3000
```

Stop with **Ctrl+C**. `.env.local` must contain the two Supabase values or the
app shows a "not connected" screen.

## Claude Code setup

This repo is built to be driven by Claude Code in VS Code.

1. Open the **folder** in VS Code (File → Open Folder).
2. Claude Code automatically reads `AGENTS.md` (via `CLAUDE.md`) and everything
   in `docs/`, so it already knows the project's rules and layout.
3. Install the **superpowers** plugin so the recommended skills are available
   (brainstorming, systematic-debugging, code review, verification). In Claude
   Code: `/plugin`, then install `superpowers`. `AGENTS.md` references these
   skills by name.

## How to ask for changes

- Describe the goal in plain words ("add a search box to Recipes"). For anything
  bigger than a tiny tweak, Claude will plan with you first, then build.
- After a big feature it runs a full code review; small tweaks get a quick one.
- It checks the app builds (`npm run build`) and runs before saying it's done.

## Tips

- **See errors:** open the browser dev console (F12 / Cmd+Option+J). App errors
  print there. See [`debugging.md`](./debugging.md).
- **See the data:** the Supabase dashboard → **Table editor** shows the live
  tables; handy to confirm a change actually saved.
- **A change didn't show:** reload the page. Data loads when a page opens.
