# Design — how the app should look and feel

This is an **admin tool**, not a website. Nobody visits it to be impressed; the
staff open it to answer "how much do we have" or "log this delivery" and get on
with their shift — often one-handed, on a phone, in a loud kitchen.

So the whole design goal is: **make the next task fast and unambiguous.**
Everything below follows from that.

---

## The five rules

**1. Boring and consistent beats clever.**
The same thing should look the same on every page. A staff member who learns the
Products page should already know how Deliveries works. Novelty costs them time
and gains nothing.

**2. Nothing decorative.**
No gradients, drop shadows, glows, animated transitions, illustrations, or
"hero" sections. If a pixel isn't helping someone read a number or press the
right button, it shouldn't be there.

**3. Color carries meaning, never decoration.**
Green = fine. Red = a problem or a destructive action. Yellow = warning, needs
attention. Grey = neutral. That's the whole vocabulary. The moment we colour
something just to brighten it up, red stops meaning "danger" and the tool gets
less safe.

**4. Numbers are the interface.**
This app is mostly quantities, prices and dates. Align them, format them
consistently (`src/lib/format.ts`), and let them be the loudest thing on screen.
Whitespace and hierarchy do the organising — not boxes, borders and dividers.

**5. Assume a phone.**
Fluid layouts with `sm:`/`md:` where useful. Tap targets big enough for a thumb.
**Never hide anything behind hover** — there is no hover on a phone, so
hover-only actions are invisible to half the users.

---

## What we already have — use it, don't reinvent

**Colour tokens** (`src/app/globals.css`). Light and dark are both defined. They
follow the OS by default, and **Поставки → Изглед** lets someone force light or
dark for their own browser (`src/lib/theme.ts` sets `data-theme` on `<html>`).
Not everyone wants their whole machine's setting applied to a work tool.

**Always use the token, never a raw hex:**

| Token | Use for |
|---|---|
| `background` / `surface` | page background / raised cards |
| `foreground` / `muted` | primary text / secondary text |
| `border` | separators, input outlines |
| `primary` | the main action on a screen |
| `danger` / `warning` / `success` | destructive, caution, good |

Hardcoding `#fff` or `text-gray-500` breaks dark mode, silently, and usually
nobody notices until the friend opens it at night.

**Ready-made classes:** `.card`, `.btn-primary`, `.btn-ghost`, `.btn-danger`,
`.input`, `.label`.

**Ready-made components** (`src/components/ui/`): `PageHeader`, `EmptyState`,
`Badge` (6 tones), `Modal`, `Toast`, `Icons`.

Before building any new UI, check this list. A new one-off button style is a bug,
not a feature.

---

## Page shape

Every page follows the same skeleton, so nobody has to relearn it:

```
PageHeader  — title, one-line subtitle, actions on the right
   ↓
filters / search (only if the list is genuinely long)
   ↓
the data — cards on mobile, table on wide screens
   ↓
EmptyState when there's nothing yet
```

**Only one primary button per screen.** If everything is `.btn-primary`, nothing
is. Secondary actions are `.btn-ghost`.

**Empty states say what to do next**, not just "no data" — "Нема продукти. Додади
го првиот." A dead end is a support call.

**Destructive actions confirm first**, and the confirm button is `.btn-danger`.
Deleting a delivery moves stock; there is no undo.

**Errors say what to do.** "Failed to save" tells a non-technical user nothing.
Say what went wrong and what to try. UI text is **Macedonian**, matching the rest
of the app.

---

## Pushing back on design requests

The owner is not a designer, and that's fine — he knows the restaurant, which is
the harder half. But an admin tool degrades fast under well-meant requests, and
**it is Claude's job to push back, explain why, and offer the better version.**
Not to silently comply, and not to refuse — to *teach*.

**How to push back well:** don't argue about taste, ask what problem he hit.
"Make it prettier" almost always means something concrete — *I can't find the
low-stock items*, *this screen feels slow*, *I keep tapping the wrong button*.
Fix that, and the request evaporates.

Common asks and the honest answer:

| The ask | Why it hurts | Offer instead |
|---|---|---|
| "Make it pop" — shadows, gradients, animation | Adds visual noise to a screen people scan 40× a day; slows comprehension | Ask which number is hard to find, then raise *its* hierarchy |
| "More colours" | Destroys the red/green safety signal | Keep the 4-colour vocabulary; use spacing and weight for hierarchy |
| "Add a chart for this" | A chart that doesn't answer a question is decoration with extra loading time | Ask what decision it informs. The Аналитика page earns its charts — food cost, ABC and days-of-stock answer "what's losing money" and "what runs out first". A chart that answers nothing doesn't get built |
| "Put the logo everywhere" | Branding is for customers; staff already know where they work | Logo once, in the nav |
| "Fit more on screen" (smaller text) | Unreadable in a kitchen, and mistyped quantities corrupt stock | Show fewer columns on mobile, full table on desktop |
| "Custom font" | A dependency and a load cost for zero task benefit | System font stack — fast, familiar, renders everywhere |
| "Make this page look different from the others" | Consistency is what makes the tool learnable; a one-off layout costs the user every time they land on it | Fix what's actually hard to find on the page as it is |
| "Hide the buttons until you hover" | Invisible on touch, which is most of the usage | Keep actions visible, or put them in a row-level menu |

**When he insists after hearing the downside, build it.** He owns the tool and he
has the full picture. Say the concern once, clearly, then do the work properly —
don't do a half-hearted version to prove a point.

---

## Before calling a UI change done

- Looks right in **light and dark** (the tokens do this for free — if it breaks,
  something was hardcoded).
- Works **narrow** — resize to phone width; nothing overflows sideways.
- Every action reachable **without hover**.
- Reused the existing components rather than adding near-duplicates.
