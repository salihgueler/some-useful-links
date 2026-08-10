# AGENTS.md

## Project Overview

Some Useful Links is a local-first, multi-page link-sharing application built
with Next.js App Router, React, strict TypeScript, and Tailwind CSS. Public
pages, admin tools, analytics, and share-card generation all run without cloud
infrastructure.

Treat `README.md` as the product and setup reference, `DESIGN_SPEC.md` as the
visual source of truth, and `src/lib/services/README.md` as the data-layer
contract.

## Commands

```bash
npm install
npm run dev
npm run validate:links
npm run lint
npm run build
```

- `npm run dev` starts Next.js on `http://localhost:3000` and validates link
  configuration first.
- `npm run validate:links` validates `src/lib/config/links.json` against its
  schema and checks page/link uniqueness.
- `npm run lint` runs the strict TypeScript check. There is no separate ESLint
  command or unit-test suite.
- `npm run build` is the required production verification.

For UI changes, start the app and run:

```bash
node scripts/visual-check.mjs
```

The visual check expects Chrome at the macOS default path. Override the browser
with `PLAYWRIGHT_CHROME_PATH` and the server with `BASE_URL` when needed. It
writes screenshots to `/tmp`.

## Architecture

- `src/app`: App Router pages, layouts, route handlers, and API endpoints.
- `src/components`: UI grouped by admin, analytics, layout, links, share, and
  reusable controls.
- `src/lib/config`: Page configuration, JSON Schema, and matching TypeScript
  types.
- `src/lib/services/interfaces`: Backend-neutral service contracts.
- `src/lib/services/local`: Local JSON-backed implementations.
- `src/lib/services/index.ts`: The only provider registration and swap point.
- `src/styles/globals.css`: Shared styles and responsive behavior.
- `public`: Static assets.

Public routes are `/` and `/:slug`. Page-scoped admin routes live under
`/admin/:slug/*`. API handlers live under `/api/pages`, `/api/analytics`, and
`/api/track`.

## Implementation Rules

- Preserve React Server Components by default. Add `"use client"` only where
  browser APIs, state, effects, event handlers, Canvas, or charts require it.
- Import services from `@/lib/services`; components and route handlers must not
  import `src/lib/services/local/*` directly.
- Keep provider-specific behavior behind the existing interfaces. Replacing a
  backend should require changing constructors in `src/lib/services/index.ts`,
  not application consumers.
- Use the `@/*` alias for imports under `src`.
- Follow the existing strict TypeScript style. Avoid `any`, unchecked casts,
  and duplicated domain types.
- Reuse existing UI components and Lucide icons before introducing new
  primitives or hand-drawn SVG controls.
- Preserve accessible names, visible focus states, keyboard operation, and
  reduced-motion behavior.
- Do not add cloud SDKs, deployment configuration, external persistence, or
  source-controlled credentials unless the task explicitly requires them.
- Keep unrelated refactors and generated-file churn out of focused changes.

## Configuration And Data

`src/lib/config/links.json` is source-controlled application data. When editing
it:

1. Keep the `$schema` reference.
2. Keep page slugs globally unique.
3. Keep link IDs unique within each page.
4. Preserve the configured limits and formats in `links.schema.json`.
5. Keep `links.types.ts` and the schema aligned when changing data shape.
6. Run `npm run validate:links`.

The admin UI also persists page edits to this file through the local link
store.

`src/lib/services/local/data/seed-data.json` is stable development seed data.
`analytics.json` and `visits.json` are runtime files and are gitignored. Do not
treat changes to those two files as source changes or rely on their contents in
tests.

Dates use `YYYY-MM-DD`, timestamps use ISO 8601 UTC, and counts are
non-negative integers. Analytics and events are always scoped by page slug;
click events also require a link ID.

## UI Guidance

- Follow `DESIGN_SPEC.md` and the screenshots in `design-previews/`.
- Preserve the Manrope font, theme tokens, spacing, and responsive breakpoints
  already defined in Tailwind and `globals.css`.
- Verify visitor pages at the 390px reference width and admin views at desktop
  width. Avoid horizontal overflow.
- Keep public pages lightweight and SSR-friendly. Share images remain
  browser-generated with Canvas and QRCode.
- Maintain the current visual hierarchy and accessible contrast when adding
  page-specific appearance controls.

## Verification

Run checks appropriate to the change:

- Configuration only: `npm run validate:links`
- TypeScript or behavior: `npm run lint`
- Shared architecture, routes, or dependencies: `npm run build`
- UI, responsive layout, share canvas, or admin workflows: run the build and
  `node scripts/visual-check.mjs` against a running server

Before finishing, confirm that temporary pages created during manual or visual
testing were removed and that no credentials or runtime analytics files were
added.
