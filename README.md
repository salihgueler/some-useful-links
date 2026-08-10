# Some Useful Links

A local-first, multi-page LinkTree-style Next.js application. Every page has
its own slug, links, appearance, analytics, public share card, and admin tools.

## Setup

```bash
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The `predev` hook validates
the entire page collection before Next.js starts.

Production verification:

```bash
npm run build
npm start
```

## Pages and URLs

The sample configuration includes:

- `/` for the default `home` page
- `/reinvent2026` for the re:Invent field guide

Create another page with the plus button in the admin header. Its slug becomes
the public URL, for example `someusefullinks.com/team-reading`.

Each page has scoped admin routes:

```text
/admin/:slug/links
/admin/:slug/analytics
/admin/:slug/appearance
/admin/:slug/share
```

The page selector switches between collections without losing the active admin
section.

## Admin Tools

Start at
[http://localhost:3000/admin/home/links](http://localhost:3000/admin/home/links).

- **Links:** edit page identity, add/remove links, set visibility, and reorder.
- **Analytics:** page-scoped totals, chart, top links, and referrers.
- **Appearance:** edit five color tokens and choose raised, flat, or outline
  link buttons with a live preview.
- **Share card:** preview, download a 1200x630 PNG, or copy the canonical URL.

Without configuration, admin routes are open for local development. To protect
them, copy `.env.example` to `.env.local`, set `ADMIN_PASSWORD`, and restart the
server. The browser then prompts for HTTP Basic Auth.

## Edit Configuration Directly

Admin edits persist to `src/lib/config/links.json`. Agents can also edit it:

1. Keep the `$schema` reference to `links.schema.json`.
2. Add or modify a page under `pages`.
3. Keep page slugs globally unique and link IDs unique within each page.
4. Run `npm run validate:links`.
5. Restart the development server.

Each page requires `slug`, `meta`, `appearance`, and one or more `links`.
Set a link's `enabled` field to `false` to retain it without rendering it.

## Local Backend

Application code accesses local data only through interfaces in
`src/lib/services/interfaces` and the registry in `src/lib/services/index.ts`.

- Page configuration: `src/lib/config/links.json`
- Page-scoped analytics: `src/lib/services/local/data/analytics.json`
- Raw page events: `src/lib/services/local/data/visits.json`
- Development seed: `src/lib/services/local/data/seed-data.json`

Runtime analytics and visit files are gitignored. See
`src/lib/services/README.md` for contracts and provider migration steps.

## Rendering

- `/` and `/:slug`: dynamic SSR with small client islands for tracking/sharing
- `/admin/:slug/*`: dynamic SSR with focused client editors and charts
- Share cards: Canvas API plus QRCode, generated entirely in the browser
- Font: Manrope through `next/font/google`

No cloud SDK, deployment descriptor, or external API is required.
