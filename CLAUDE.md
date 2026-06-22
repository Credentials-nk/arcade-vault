# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

**Arcade Vault** is an online gaming platform where players compete for points. The project uses Spec Driven Design methodology with `/spec` and `/spec-impl` skills.

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

## Project Structure

### Core Directories
- **app/** — Next.js App Router (routing, layouts, pages)
  - `layout.tsx` — Root layout
  - `page.tsx` — Home page
- **node_modules/** — Dependencies (excluded from TypeScript checks)

### Configuration Files
- `tsconfig.json` — TypeScript strict mode enabled, paths aliased as `@/*` → project root
- `next.config.ts` — Next.js configuration (currently minimal)
- `eslint.config.mjs` — ESLint with Next.js web vitals and TypeScript rules
- `postcss.config.mjs` — Tailwind CSS 4 integration via `@tailwindcss/postcss`

## Technology Stack

| Layer | Technology | Version |
|-------|-----------|---------|
| Framework | Next.js | 16.2.9 |
| UI Library | React | 19.2.4 |
| Styling | Tailwind CSS | 4 |
| Language | TypeScript | 5 |
| Linting | ESLint | 9 |

## TypeScript & Path Aliases

- **Target:** ES2017, strict mode enabled
- **Path alias:** `@/*` resolves to project root (e.g., `@/app/page.tsx`)
- Files: `.ts`, `.tsx`, `.mts` are included; `node_modules` excluded

## Spec Driven Design Workflow

This project follows Spec Driven Design practices. When implementing features:

1. **Use `/spec`** to define specifications for new features or APIs
2. **Use `/spec-impl`** to implement based on approved specs
3. Reference: https://github.com/Klerith/fernando-skills

## ESLint Rules

- Core Web Vitals rules enabled
- TypeScript-specific rules enforced
- Ignores: `.next/`, `out/`, `build/`, `next-env.d.ts`

## Key Notes for Development

- **Tailwind CSS 4:** Uses the new `@tailwindcss/postcss` plugin (NOT the traditional config file approach)
- **Strict TypeScript:** All code must satisfy strict type checking
- **React 19:** Uses React 19 with the new JSX transform
- **No testing framework configured:** Add test setup if needed
- **No environment variables configured:** Add `.env.local` if secrets/configs are needed
