# AGENTS.md

## Project Overview

Some Useful Links is a multi-owner link-sharing application built with Next.js
App Router, React, strict TypeScript, and Tailwind CSS. Sign-up is open to any
confirmed email address; collection pages stay public. Data lives
in AWS Blocks (`aws-blocks/`) in three owner-partitioned DistributedTables.

Treat `README.md` as the product and setup reference, `DESIGN_SPEC.md` as the
visual source of truth, and `src/lib/services/README.md` as the data-layer
contract.

## Commands

```bash
npm install
npm run dev:api        # Blocks server on :3000, fronts Next on :3100
npm run validate:links
npm run lint
npm run build
```

- `npm run dev:api` is the entry point for anything involving sign-in: it serves
  the API and the app on ONE origin, which the session cookie requires.
- `npm run dev` starts Next alone. The UI renders but every API call fails, so
  use it only for isolated UI work.
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
- `src/lib/services/blocks`: Active AWS Blocks implementations.
- `src/lib/services/local`: Original JSON implementations, kept as reference and
  NOT wired up.
- `src/lib/services/index.ts`: The only provider registration and swap point.
- `aws-blocks/`: Backend. Auth, the three tables, and the JSON-RPC API.
- `src/styles/globals.css`: Shared styles and responsive behavior.
- `public`: Static assets.

`/` is a landing page and serves no collection. Public collection pages are
`/:slug`. Admin routes under `/admin/:slug/*` and the `/api/pages` and
`/api/analytics` handlers require a verified session; `/api/track` is public by
design.

Reads split into public (no session, resolves the slug reservation) and
owner-scoped (forwards the session; another owner's slug reads as absent). When
touching a data path, keep that split — a public route that calls an
owner-scoped read breaks for anonymous visitors.

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
- Use AWS Blocks building blocks; never raw AWS SDK calls.
- Never accept an owner ID from request input -- derive it from the verified
  session. Never add a global scan for a user-visible operation.
- Do not commit credentials. `.bb-data/` holds local mock auth data and is
  gitignored.
- Keep unrelated refactors and generated-file churn out of focused changes.

## Configuration And Data

`src/lib/config/links.json` is NO LONGER runtime data -- collections live in
DynamoDB via Blocks. It remains the fixture that `npm run validate:links` checks
against `links.schema.json`, which is still the single source of truth for page
shape and is enforced at runtime by `validatePageInput()`. When editing it:

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
