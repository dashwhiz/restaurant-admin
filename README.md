# Lira Inventory

Inventory, sales and cost tracking for the Lira gostilnica. Rewrite of the old
single-file HTML app, using the **same Supabase database**.

> Contributor & AI-agent guidance: [`AGENTS.md`](./AGENTS.md).
> Deeper docs: [`docs/`](./docs).

---

## Run it on your computer (step by step)

You only need to do steps 1–2 **once**.

### 1. Install Node.js (once)

Download the **LTS** version from <https://nodejs.org> and install it (just keep
clicking Next). This gives you `node` and `npm`.

To check it worked, open a terminal (in VS Code: **Terminal → New Terminal**) and run:

```bash
node -v
```

You should see a version number like `v26.x`.

### 2. Install the app's building blocks (once)

In the terminal, make sure you're inside this folder, then run:

```bash
npm install
```

This downloads everything the app needs. It can take a minute.

### 3. Start the app

```bash
npm run dev
```

Then open **<http://localhost:3000>** in your browser. That's it.

To stop the app, press **Ctrl + C** in the terminal. To start it again next
time, just run `npm run dev` again.

---

## The connection settings (`.env.local`)

The app connects to your Supabase database using two values kept in a file
called `.env.local`. **It's already filled in for you.** You only need to touch
it if the database keys change.

If you ever need to recreate it: copy `.env.local.example` to `.env.local` and
paste your values from Supabase (**Settings → API**):

- `NEXT_PUBLIC_SUPABASE_URL` — the project URL
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — the public "anon" key
- `NEXT_PUBLIC_ANTHROPIC_API_KEY` — (optional) only for invoice scanning

This file is private — it is never uploaded to GitHub.

---

## Making changes with Claude Code

Open this folder in VS Code and talk to Claude Code. It reads
[`AGENTS.md`](./AGENTS.md) and the `docs/` automatically, so it knows how the
project is organized and how you like to work. When you ask for a change:

- For anything non-trivial, it will plan with you first (in plain language)
  before writing code.
- After a big feature it runs a full code review; small tweaks get a quick
  review.
- It verifies changes build and run before telling you they're done.

See [`docs/running-locally.md`](./docs/running-locally.md) for the one-time
Claude Code setup (installing the "superpowers" skills).

---

## Everyday commands

| Command | What it does |
|---|---|
| `npm run dev` | Start the app for local use (what you'll use daily) |
| `npm run build` | Check the whole project compiles with no errors |
| `npm run lint` | Check code style |

There are no automated tests yet — the app is checked by building and by using it.
