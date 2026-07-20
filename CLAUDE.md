# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Arcade Vault** is an online retro-arcade platform: a catalog of playable canvas games where players compete on a global and per-game leaderboard. The project is built entirely with Spec Driven Design — every feature starts as a spec in `specs/` before any app code is written. Specs 01–10 are all **Implementado**; the platform currently has a home, library, game detail/play pages, an about/contact form, a Supabase-backed catalog + scores system, and four fully playable games (Asteroids, Caída/Tetris, Bloque Buster/Arkanoid, Serpentina/Snake).

## Git Workflow

**IMPORTANT:** `main` is a protected branch. **Never commit directly to main.** All changes must be made in feature branches and merged via Pull Requests on GitHub.

**Workflow:**

1. Create a feature branch matching the spec (e.g., `07-caida-game`, `09-games-catalog-supabase`)
2. Make commits in the feature branch
3. Push the branch to GitHub
4. Create a Pull Request for review
5. Merge via PR (this updates main)
6. Delete the feature branch after merge

## Critical: Next.js 16.2.9 Breaking Changes

This project uses Next.js 16.2.9, which has breaking changes from previous versions. **Before writing any code:**

- Check `node_modules/next/dist/docs/` for API changes and conventions
- Review deprecation notices carefully
- Do NOT rely on training data about Next.js conventions—they may be outdated

Reference: `AGENTS.md`

## Development Commands

```bash
npm run dev      # Start dev server (http://localhost:3000)
npm run build    # Build for production
npm start        # Start production server
npm run lint     # Run ESLint (no specific flags in config, use eslint <file> for targeted linting)
```

The `supabase` MCP server is enabled for this project (`list_tables`, `execute_sql`, `list_migrations`, etc.) — prefer it over guessing schema when touching anything that reads/writes `games` or `scores`.

## Project Structure

### Core Directories

- **app/** — Next.js App Router (routing, layouts, pages)
  - `layout.tsx` — Root layout
  - `page.tsx` — Home page (hero, ticker, global leaderboard preview)
  - `library/page.tsx` — Full games catalog with category filter
  - `hall/page.tsx` — Salón de la Fama (games list is real/Supabase; per-tab score rows are still `seededScores` fake data — see spec 09 out-of-scope)
  - `about/page.tsx` + `about/actions.ts` — Contact form, sends via Resend
  - `auth/page.tsx` — Mock login (no real auth backend, see `hooks/useUser.ts`)
  - `game/[id]/page.tsx` — Server-rendered game detail page (cover, description, per-game leaderboard). Reads the catalog via `getGame(id)`.
  - `game/[id]/play/page.tsx` — **Generic placeholder** player shell (fake HUD/arena) for catalog entries that don't have a real engine yet
  - `games/<id>/page.tsx` — **Real playable game pages** (currently `asteroids`, `caida`, `bloque-buster`, `serpentina` — see `references/implemented-games.md` for the up-to-date list with id/título/categoría/descripción/color), each with a synced HUD, pause, and game-over modal that calls `saveScore`
  - `actions/` — Server Actions: `getGames.ts` (`getGames()`/`getGame(id)`), `getLeaderboard.ts` (`getGameLeaderboard(gameId)`/`getGlobalLeaderboard()`), `saveScore.ts`
- **lib/**
  - `data.ts` — Shared types (`Game`, `ScoreRow`, `LeaderboardEntry`, `TickerRow`), `CATS`, and `seededScores()` (fake data helper still used by the Hall of Fame score rows)
  - `supabase/client.ts` — Browser Supabase client (`createBrowserClient`)
  - `supabase/server.ts` — Server Supabase client (`createServerClient`, cookie-based, async — must `await createClient()`)
  - `games/<id>/game.ts` — Canvas game engines in strict TypeScript, one per game (see "Game integration pattern" below)
- **components/**
  - `Nav.tsx` / `NavWrapper.tsx` — Top nav + mobile panel, reflects mock auth state
  - `games/<id>/<Name>Game.tsx` — Client components that mount the `<canvas>`, instantiate the matching engine, and destroy it on unmount
- **hooks/**
  - `useUser.ts` — Mock auth backed by `localStorage` (no Supabase Auth wired up yet)
  - `useReveal.ts` — Scroll-reveal animation hook
- **specs/** — One markdown file per feature (`NN-slug.md`), each with an `Estado` (Borrador → Aprobado → Implementado), Scope, data model, implementation plan and acceptance criteria
- **references/** — Project reference docs: `implemented-games.md` (canonical list of integrated games with id/título/categoría/descripción/color) and `game-suggestions.md` (the `@game-planner` subagent's shared, versioned memory of proposed/discarded game ideas)
- **.claude/skills/** — `spec`, `spec-impl`, `add-game`, `frontend-design`
- **.claude/agents/** — `game-planner` (subagent that decides which new game to add next — see "Subagents" below)
- **node_modules/** — Dependencies (excluded from TypeScript checks)

### Configuration Files

- `tsconfig.json` — TypeScript strict mode enabled, paths aliased as `@/*` → project root
- `next.config.ts` — Next.js configuration (currently minimal)
- `eslint.config.mjs` — ESLint with Next.js web vitals and TypeScript rules
- `postcss.config.mjs` — Tailwind CSS 4 integration via `@tailwindcss/postcss`
- `.env.local` — Required: `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_DB_PASSWORD`, `RESEND_API_KEY`
- `.claude/settings.json` — PostToolUse hook runs `post-tool-format.ps1` (Prettier) after every `Write`/`Edit`

## Technology Stack

| Layer      | Technology                                          | Version                           |
| ---------- | --------------------------------------------------- | --------------------------------- |
| Framework  | Next.js                                             | 16.2.9                            |
| UI Library | React                                               | 19.2.4                            |
| Styling    | Tailwind CSS                                        | 4                                 |
| Language   | TypeScript                                          | 5                                 |
| Linting    | ESLint                                              | 9                                 |
| Formatting | Prettier                                            | 3 (auto-run via PostToolUse hook) |
| Backend    | Supabase (`@supabase/ssr`, `@supabase/supabase-js`) | 0.12 / 2.108                      |
| Email      | Resend                                              | 6                                 |

## TypeScript & Path Aliases

- **Target:** ES2017, strict mode enabled
- **Path alias:** `@/*` resolves to project root (e.g., `@/app/page.tsx`)
- Files: `.ts`, `.tsx`, `.mts` are included; `node_modules` excluded

## Backend: Supabase

Two tables back the whole app (see `specs/04-supabase-setup.md`, `specs/06-leaderboard.md`, `specs/09-games-catalog-supabase.md` for full history):

- **`games`** — the catalog (`id, title, short, long, cat, cover, color, best, plays, play_route, sort_order`). Public read-only RLS; no insert/update/delete for the anon role — the catalog is managed **only via migrations**, never from the app. `lib/data.ts`'s `Game` interface describes its shape but no longer holds the data (it used to be a hardcoded array before spec 09).
- **`scores`** — one row per saved score (`game_id` FK → `games.id`, `player_name`, `score`, `created_at`). Written only through `saveScore(gameId, playerName, score)`.

`getGameLeaderboard(gameId)` and `getGlobalLeaderboard()` in `app/actions/getLeaderboard.ts` are already generic across every `game_id` — **never re-implement per-game leaderboard logic**, new games get it for free.

## Game integration pattern

There is one validated reference implementation (Asteroids) that every subsequent game has copied. Before adding a new one, check `references/implemented-games.md` for the current id/título/categoría/descripción/color of every implemented game — pick a new `id` and avoid colliding categories/colors. To **decide which** game to add next, run the **`@game-planner`** subagent first — it proposes a non-colliding candidate and records the choice in `references/game-suggestions.md` (see "Subagents"). When adding a new game, use the **`/add-game`** skill instead of improvising — it reads this same pattern from the live code and generates a spec for `/spec-impl` to implement. The pattern:

1. `lib/games/<id>/game.ts` — engine in strict TypeScript with a **callback bridge** (`onScore`, `onLives`, `onLevel`, `onGameOver` — omit any the game doesn't have, e.g. Snake has no lives) that notifies React of internal state changes.
2. `components/games/<id>/<Name>Game.tsx` — client component that mounts the `<canvas>`, constructs the engine with the callbacks, destroys it on unmount.
3. `app/games/<id>/page.tsx` — HUD synced to the callback state, pause button, and a game-over modal capturing a name (max 10 chars, uppercased) that calls `saveScore('<id>', name || 'INVITADO', finalScore)`.
4. A row in the Supabase `games` table (via migration) with `play_route = '/games/<id>'` — this is what makes the catalog entry link to the real page instead of the generic `/game/[id]/play` placeholder.
5. The `id` used in the route, the `saveScore` call, and the `games` table row **must all match** — that's what ties the game to its leaderboard.

## Spec Driven Design Workflow

Every feature starts as a spec before any app code is written.

1. **`/spec`** — generic spec generator (question-driven, uses `.claude/skills/spec/template.md`)
2. **`/add-game`** — specialized spec generator for integrating a new canvas game; pre-loads the pattern above so it doesn't have to be re-derived per game
3. **`/spec-impl`** — implements an approved spec (`specs/NN-slug.md`), commit by commit per its plan; the **last** step of any `/spec-impl` run updates the spec's `Estado` to **Implementado** and commits that before opening the PR
4. Spec lifecycle: **Borrador** (drafted, awaiting human approval) → **Aprobado** → **Implementado**
5. Reference: https://github.com/Klerith/fernando-skills

Current specs (all Implementado): `01-mvp-screens`, `02-home-screen`, `03-about-contact`, `04-supabase-setup`, `05-asteroids-game`, `06-leaderboard`, `07-caida-game`, `08-bloque-buster-game`, `09-games-catalog-supabase`, `10-serpentina-game`.

## ESLint Rules

- Core Web Vitals rules enabled
- TypeScript-specific rules enforced
- Ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`

## Key Notes for Development

- **Tailwind CSS 4:** Uses the new `@tailwindcss/postcss` plugin (NOT the traditional config file approach)
- **Strict TypeScript:** All code must satisfy strict type checking — game engines especially (see "Risks" in specs 05/07/08/10 about migrating mutable globals to TS strict without disabling strict mode)
- **React 19:** Uses React 19 with the new JSX transform
- **No testing framework configured:** Add test setup if needed
- **Auth is mocked:** `hooks/useUser.ts` stores a display name in `localStorage`; there is no real Supabase Auth session yet
- **Two different "game player" experiences coexist:** `/game/[id]/play` is a generic fake-arena placeholder for catalog entries without a `play_route`; `/games/<id>` is the real, playable, per-game page. Don't confuse the two when navigating or wiring links.

## Playwright Screenshots

Always save Playwright screenshots to `.playwright-screenshots/` in the project root. Pass the filename with that prefix:

```ts
filename: '.playwright-screenshots/my-screenshot.png';
```

Never save screenshots to the project root or any other directory.

## Skills

- **Always use `/frontend-design` when creating HTML designs.** Provides guidance for distinctive, intentional visual design with attention to typography and aesthetic choices.
- **Use `/add-game` to integrate a new canvas game** into the platform (generates the spec; `/spec-impl` does the actual implementation).
- **Use `/spec` / `/spec-impl`** for any other new feature, following the Spec Driven Design workflow above.

## Subagents

Subagents live in `.claude/agents/*.md` and are invoked explicitly with `@<name>` (or via the Agent tool). Unlike skills, they run in their own context and return a result.

- **`@game-planner`** — decides **which new canvas game to add next**. It sits **upstream of `/add-game`**: `@game-planner` decides _what_ game, `/add-game` generates the spec, `/spec-impl` implements it. It reads the catalog (`references/implemented-games.md`, the Supabase `games` table, and `CATS` + the color palette in `lib/data.ts`) and its own shared memory `references/game-suggestions.md`, then returns a ranked shortlist plus one recommendation, balancing fun, mechanic diversity, and filling empty categories/colors. Every proposal is **recorded in `references/game-suggestions.md`** (versioned, team-shared) so an idea is never proposed twice and never collides with an existing `id`/category/color. It does **not** write app code or specs — it stops at the recommendation and the memory update, then hands off to `/add-game`.
- **`@game-jam`** — takes a **free-form theme** (e.g. `"vikingos"`) and conceives **2–3 distinct canvas games** around it, writing **one complete spec per game** (same anatomy as specs 07/08/10: engine + component + `/games/<id>` page + `games` table row + leaderboard) into `specs/game-jam/<theme>/`, all in **Borrador**. Unlike `@game-planner` (which only decides and writes no specs) and `/add-game` (which specs a single given game), it produces a **batch** of specs from a theme. It reads the same context (`references/implemented-games.md`, `game-suggestions.md`, `CATS` + palette in `lib/data.ts`, the live Asteroids pattern) so game `id`/`cat`/`color` never collide — within the batch or with existing games — and records each proposal in `references/game-suggestions.md`. It does **not** write app code: the human reviews the drafts, promotes them to **Aprobado**, then `/spec-impl` implements each. Note: `/spec-impl` doesn't recurse into subfolders, so a chosen spec must be moved to `specs/NN-slug.md` (next global number) or passed by path before implementing.
- **`@skin-designer`** — designs **and implements** visual skins/themes for the games. **Unlike `@game-planner`/`@game-jam`, this agent DOES edit app code.** It maintains **3 canonical skins** — `neon` (the current look), `clasico` (sober arcade, the new default), and `retro` (monochrome CRT: amber/green phosphor + scanlines) — in a new `lib/skins.ts`, and assigns **one fixed skin per game** (no runtime selector), recorded in `references/game-skins.md`. To apply a skin it parameterizes the engine's palette via constructor (`lib/games/<id>/game.ts`), injects it from the component, sets `data-skin` on the page, and adds `[data-skin]` overrides in `app/globals.css` (refactoring hardcoded `rgba()` glows to `var(--...)`). It respects the app's **dark-only** design (every skin must read well over `--bg #0a0a0f`), never touches gameplay/callbacks, keeps `npm run build` green, and verifies with Playwright screenshots to `.playwright-screenshots/`. It does **not** commit, push, or branch — it leaves the diff for the human. Note: **Bloque Buster** paints from a PNG spritesheet (not `fillStyle`), so it's the hardest to reskin — prefer assigning it a low-friction skin (neon/clasico) rather than retro.
