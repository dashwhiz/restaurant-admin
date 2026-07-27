# Debugging

Optimized for a non-technical owner + Claude Code. When something's wrong, work
top to bottom.

## 1. Reproduce it, then read the console
- Do the exact steps that break.
- Open the browser dev console (**F12**, or **Cmd+Option+J** on Mac). Red lines
  are errors — copy the whole message (and the file:line) to Claude.
- The app shows a red toast on failures; the console has the detail.

## 2. Is it data or code?
- Open Supabase → **Table editor**. Did the row actually save / change?
  - Row is correct but the screen is wrong → **UI/code** bug. Reload first
    (data loads on page open).
  - Row is wrong/missing → the **save** failed → look at the service function
    for that feature (`src/lib/services/<feature>.ts`) and the console error.

## 3. Common causes
- **"Базата не е поврзана" screen** → `.env.local` missing/incomplete, or the
  server wasn't restarted after editing it. Fix values, re-run `npm run dev`.
- **Nothing loads / network errors** → wrong Supabase URL/key, or no internet.
- **A number looks off (stock/price)** → check the service that writes it. Stock
  bugs are almost always a missing *reverse* on edit/delete — see
  [`features/stock.md`](./features/stock.md).
- **Build fails** → run `npm run build`; the error names the file and line.

## 4. For Claude
- Use `superpowers:systematic-debugging`: reproduce → find the root cause →
  fix the cause, not the symptom. Don't guess-patch.
- Add temporary `console.log('[LIRA] ...', value)` lines in the suspect service
  to trace values; remove them once fixed.
- Verify the fix by re-doing the original steps in `npm run dev`, not just by
  reasoning about the code.
