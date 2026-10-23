# Some Useful Links

A multi-owner, LinkTree-style Next.js application. Each signed-in owner keeps
their own collections; every collection has its own slug, links, appearance,
analytics and public share card.

Anyone with an email address can create an account. Collection pages
themselves are public: anyone with the link can open one.

## Features

**Collections.** An owner can keep up to 50 collections, each at its own public
slug, created from scratch or from a starter template, switchable from a picker
in the admin nav, renamable (the old slug then 404s), and deletable. Slugs are
globally unique across all owners, enforced by a reservation record, so claiming
a taken one fails with 409.

**Links.** Up to 20 per collection, each with a label, an optional caption, a
destination URL, and an emoji icon on a colour of its own. Links can be
reordered with move-up/move-down controls, hidden without deleting, and edited
inline. URLs are restricted to `https`, `http` and `mailto`. Links open in a new
tab; `mailto:` stays in place.

**Appearance.** Six independently editable colour tokens — primary, header,
background, accent, logo and badge — plus three button styles (`raised`, `flat`,
`outline`), editable header title, subtitle and badge text, and an uploaded logo
that replaces the built-in mark. A palette can also be extracted from an
uploaded image: a median-cut quantiser ranks the colours by vividness, maps them
onto the six roles, and derives a light or dark page to match. Three presets
ship built in — Default, Kiro and AWS.

**Readable by construction.** Foreground colours are computed rather than
chosen: text ink is walked toward black or white until it clears a 4.5:1
contrast ratio against whichever surface it sits on, so a user cannot pick an
unreadable combination. Header and body surfaces get their own ink.

**Share cards.** A PNG social card with a live QR code to the page, generated in
the browser with Canvas, downloadable at 1200×630, 2400×1260 or 1920×1080, with
a customisable label and note.

**Analytics.** Page views, link clicks, click rate and shares, each with a trend
against the previous period; a daily views-and-clicks chart; top links by click
rate; referrer breakdown; and visits by country as a ranked list and a dot map.
Ranges of 7, 30 or 90 days or all time, aggregated by day, week or month.
Tracking is anonymous by design — see [Analytics](#analytics).

**Accessibility.** Semantic landmarks, `aria-hidden` on decorative marks, a
focus-visible ring on every interactive element, `prefers-reduced-motion`
support, and a share modal with `role="dialog"` and escape-to-close.

**Responsive.** Mobile-first single column at 390px widening to 560px above
600px, a full-bleed header band, and a share modal that becomes a bottom sheet
below 599px.

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
/admin/:slug/analytics  totals, chart, top links, referrers, countries
/admin/:slug/appearance six colour tokens and the button style
/admin/:slug/share      preview, download a PNG in three sizes, copy the URL
```

`/` deliberately serves no collection. Every collection belongs to an owner and
lives at `/:slug`, so putting one at the root would make whoever claimed a
reserved slug the face of the site.

Slugs are globally unique across all owners, enforced by a reservation record,
so claiming one that is taken fails with 409.

## Accounts

Sign-up is open to any email address. `aws-blocks/eligibility.ts` only rejects
input that cannot be an address, so malformed input fails with a clear error.

The real control is the emailed confirmation code, which proves the person
signing up owns the address. Every authenticated call re-checks that the
account's address is confirmed, so an account created out of band without
confirmation cannot act as an owner.

In local development the confirmation code is printed to the dev server log and
written to `.bb-data/some-useful-links-auth/last-code.json`; no email provider
is involved.

## Backend

Application code reaches data only through the contracts in
`src/lib/services/interfaces`, resolved by the registry in
`src/lib/services/index.ts` — the single provider swap point.

The active provider is AWS Blocks (`aws-blocks/`), with four owner-partitioned
DistributedTables:

| Table | Keys | Notes |
| --- | --- | --- |
| pages | `USER#<ownerId>` / `PAGE#<slug>` | plus `SLUG` / `<slug>` reservations |
| analytics | `USER#<ownerId>` / `A#<slug>#<date>` | daily aggregates |
| visits | `USER#<ownerId>` / `V#<slug>#<ts>#<id>` | raw events, 90-day TTL |
| countries | `USER#<ownerId>` / `C#<slug>#<date>#<id>` | day-only, 400-day TTL |

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

## Analytics

Tracking is anonymous and unauthenticated: `/app-api/track` accepts
`page-view`, `link-click` and `share` events from public pages, rate-limited to
30 requests a minute with a 1 KB body cap.

The privacy model is a set of deliberate omissions, not a policy document:

- **No IP address is stored, or even read.** Country is taken only from the
  `cloudfront-viewer-country` header CloudFront adds at the edge.
- **Referrers are reduced to their origin** before storage, so query strings —
  which can carry tokens — never reach the table.
- **Country lives in its own table, keyed to the day rather than the moment.**
  It is deliberately not a field on the visit event, so a country cannot be
  joined back to a timestamped, link-bearing visit.
- **Timestamps are server-assigned** and caller-supplied properties are never
  spread into a record, so an unexpected field cannot be persisted.

Note what this does *not* claim: the `visits` table does store an ISO timestamp
and a link ID per raw event. It is the *pairing* of country with those that the
split-table design prevents.

Country attribution needs `CloudFront-Viewer-Country` forwarded to the origin.
That forwarding is not configured yet, so every visit currently records `ZZ`
("Unknown"). The obvious fix — CloudFront's `ALL_VIEWER_AND_CLOUDFRONT_2022`
origin request policy — also forwards `Host`, which makes API Gateway reject the
request, so this needs a custom policy that selects the country header without
`Host`.

## Environment

```bash
BLOCKS_RPC_URL   # JSON-RPC endpoint. Required in any deployed environment.
                 # Local dev defaults to the Blocks dev server on port 3000.

HOSTING_CERTIFICATE_ARN
                 # Optional. An ACM certificate ARN in us-east-1. Setting it
                 # activates the custom domain; unset, the stack deploys with
                 # the CloudFront domain only.
```

Server-side session checks fail closed without `BLOCKS_RPC_URL`, so an unset
value in production means nobody can sign in.

## Deployment

```bash
npm run deploy          # deploys the production stack
npm run destroy         # tears it down
npm run sandbox         # a throwaway stack, destroyable via sandbox:destroy
```

`deploy` builds the app, runs OpenNext over it, and applies the CDK stack:
CloudFront in front of S3 for static and ISR assets, a Lambda SSR function, a
second Lambda for the JSON-RPC API behind API Gateway, Cognito, the four
DynamoDB tables, an SQS queue for ISR revalidation, and an SNS topic for
hosting alarms. Expect 5–15 minutes and do not interrupt it — a half-applied
CloudFront change is unpleasant to unpick.

`deploy`, `destroy`, `sandbox` and `sandbox:destroy` create or remove real,
billable AWS resources. Every other script is local.

### Custom domain

The domain block in `aws-blocks/index.cdk.ts` is gated on
`HOSTING_CERTIFICATE_ARN`; with the variable unset the block is spread as `{}`
and the stack behaves exactly as it did before the feature existed.

```bash
export HOSTING_CERTIFICATE_ARN='arn:aws:acm:us-east-1:<account>:certificate/<id>'
npm run deploy
```

The certificate is brought rather than provisioned, because the construct's own
provisioning path requires a Route 53 hosted zone and this domain's DNS is
elsewhere. Two requirements follow, and both are hard failures if missed:

1. **It must live in us-east-1.** CloudFront reads certificates only from
   there, and the construct rejects any other region.
2. **It must cover the apex *and* `www`.** Hosting creates its own certificate
   for the primary domain only and then reuses it for the remaining aliases, so
   a single-name certificate leaves `www` uncovered and CloudFront refuses the
   alias.

`wwwRedirect: 'toApex'` puts the redirect in a CloudFront Function backed by a
KeyValueStore, so `www` is answered with a 301 at the edge and never reaches
the origin.

No `hostedZone` is configured, so the stack creates no DNS records — DNS is
managed externally. The apex needs an `ALIAS` record (a CNAME is invalid at a
zone apex) pointing at the distribution domain, and `www` needs a CNAME to the
same target. DNSSEC must be off for the provider to accept an ALIAS.

The ACM validation CNAMEs must stay in the zone permanently: ACM re-reads them
to renew the certificate automatically, and removing them makes renewal fail
silently months later.

## Rendering

- `/`, `/:slug`, `/admin/*`: dynamic SSR with small client islands
- Share cards: Canvas API plus QRCode, generated entirely in the browser
- Font: Manrope self-hosted through `next/font/google`
- Security headers and CSP are set in `next.config.ts`
