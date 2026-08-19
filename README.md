# Some Useful Links

A multi-owner, LinkTree-style Next.js application. Each signed-in owner keeps
their own collections; every collection has its own slug, links, appearance,
analytics and public share card.

Accounts are restricted to Amazon corporate email addresses. Collection pages
themselves are public: anyone with the link can open one.

## Setup

```bash
npm install
npm run dev:api
```

Open [http://localhost:3000](http://localhost:3000).

`npm run dev:api` is the entry point for anything involving sign-in. It starts
the AWS Blocks dev server on port 3000 and Next on 3100, and fronts Next so the
app and the API share one origin — which is what the session cookie needs.

`npm run dev` starts Next alone. The UI renders, but every API call fails
because no backend is listening, so use it only for isolated UI work.

Production verification:

```bash
npm run lint     # tsc --noEmit
npm run build
```

## Routes

```text
/                       landing page (not a collection)
/:slug                  a public collection page
/login                  sign in, sign up, confirm email
/admin                  redirects to your first collection, or /admin/start
/admin/start            first-run: create a collection or use a starter
/admin/:slug/links      edit identity, links, visibility and order
/admin/:slug/analytics  totals, chart, top links, referrers
/admin/:slug/appearance five colour tokens and the button style
/admin/:slug/share      preview, download a 1200x630 PNG, copy the URL
```

`/` deliberately serves no collection. Every collection belongs to an owner and
lives at `/:slug`, so putting one at the root would make whoever claimed a
reserved slug the face of the site.

Slugs are globally unique across all owners, enforced by a reservation record,
so claiming one that is taken fails with 409.

## Accounts

Sign-up is limited to an exact allowlist of domains in
`aws-blocks/eligibility.ts` — currently `amazon.com`, `amazon.co.uk`,
`amazon.de` and `amazon.fr`. It is an exact full-domain match on purpose: a
suffix or pattern check would admit `evil-amazon.com` or `amazon.evil.com`.

The domain check decides who may *attempt* to hold an account. The real control
is the emailed confirmation code, which proves the address exists. Both are
required. The domain is re-checked on every authenticated call, so an account
created out of band, or a domain later removed from the list, loses access
immediately.

In local development the confirmation code is printed to the dev server log and
written to `.bb-data/some-useful-links-auth/last-code.json`; no email provider
is involved.

## Backend

Application code reaches data only through the contracts in
`src/lib/services/interfaces`, resolved by the registry in
`src/lib/services/index.ts` — the single provider swap point.

The active provider is AWS Blocks (`aws-blocks/`), with three owner-partitioned
DistributedTables:

| Table | Keys | Notes |
| --- | --- | --- |
| pages | `USER#<ownerId>` / `PAGE#<slug>` | plus `SLUG` / `<slug>` reservations |
| analytics | `USER#<ownerId>` / `A#<slug>#<date>` | daily aggregates |
| visits | `USER#<ownerId>` / `V#<slug>#<ts>#<id>` | raw events, 90-day TTL |

Reads split into two surfaces, and the split is load-bearing:

- **public** — `getEnabledLinks`, `getLinkById`, and tracking send no session and
  resolve the slug reservation, so a visitor sees the same page as anyone else.
- **owner-scoped** — everything else forwards the session cookie so the backend
  derives the owner from it. A slug held by another owner reads as absent.

`src/lib/services/local/*` are the original JSON implementations. They are kept
as a reference for the contracts and are no longer wired up.

`src/lib/config/links.json` is no longer runtime data. It remains as the fixture
that `npm run validate:links` checks against `links.schema.json`, which is still
the single source of truth for page shape and is enforced at runtime by
`validatePageInput()`.

## Environment

```bash
BLOCKS_RPC_URL   # JSON-RPC endpoint. Required in any deployed environment.
                 # Local dev defaults to the Blocks dev server on port 3000.
```

Server-side session checks fail closed without it, so an unset value in
production means nobody can sign in.

## Rendering

- `/`, `/:slug`, `/admin/*`: dynamic SSR with small client islands
- Share cards: Canvas API plus QRCode, generated entirely in the browser
- Font: Manrope self-hosted through `next/font/google`
- Security headers and CSP are set in `next.config.ts`
