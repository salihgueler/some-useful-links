# Service Layer

## Architecture

Application code depends on contracts and the registry, never on local files:

```text
Public/Admin Server Components + Route Handlers
                       |
                       v
             src/lib/services/index.ts
                /          |          \
               v           v           v
          LinkStore  AnalyticsStore  VisitTracker
               \           |           /
                local JSON implementations
```

`index.ts` is the single provider swap point. Components and routes must not
import `local/*`.

## Interface Reference

### `LinkStore`

`interfaces/link-store.interface.ts`

- `getConfiguration()` returns the complete page collection.
- `getPages()` returns page summaries for selectors.
- `getPage(slug)` and `getDefaultPage()` return full page records.
- `getEnabledLinks(slug?)` removes hidden links and applies display order.
- `getLinkById(pageSlug, id)` resolves a link within its page.
- `createPage(page)`, `updatePage(slug, page)`, and `deletePage(slug)` persist
  page administration. The default page cannot be deleted.

The local implementation reads and writes `src/lib/config/links.json`. The
build validator checks it against `src/lib/config/links.schema.json`.

### `AnalyticsStore`

`interfaces/analytics-store.interface.ts`

- `query({ pageSlug, startDate, endDate, linkId, aggregation })` returns one
  page's report, aggregated by day, week, or month.
- `upsertDailySnapshot(pageSlug, point)` inserts or replaces a daily aggregate.
- `resetFromSeed()` restores local development analytics.

`AnalyticsSummary` contains totals, trends, timeline points, top links, and
normalized referrer percentages.

### `VisitTracker`

`interfaces/visit-tracker.interface.ts`

- `track(input)` writes a `page-view`, `link-click`, or `share` event.
- `getMetrics({ pageSlug, startDate, endDate })` derives page-scoped totals,
  CTR, per-link counts, and referrers.
- `clear()` removes local raw events.

Every event requires `pageSlug`. Click events also require `linkId`.

## Migrate to a Provider

1. Create an implementation for the interface being replaced, such as
   `aws/link-store.aws.ts`.
2. Preserve page slugs, page-scoped link IDs, ISO dates, event names, and
   interface return types.
3. Add provider resource identifiers and credentials as server-only
   environment variables.
4. Change only the relevant constructor import in `src/lib/services/index.ts`.
5. Import `seed-data.json` if initial analytics history is needed.
6. Run `npm run validate:links`, `npm run lint`, and `npm run build`.
7. Exercise `/app-api/pages`, `/app-api/track`, and `/app-api/analytics`.

## Provider Hints

- **AWS:** S3 for page configuration, DynamoDB for page-keyed events and
  aggregates, CloudWatch for optional telemetry.
- **GCP:** Cloud Storage, Firestore, and Cloud Functions.
- **Azure:** Blob Storage, Cosmos DB, and Application Insights.
- **SQL:** Postgres or MySQL with pages, links, events, daily aggregates, and
  referrers keyed by page slug.

Use runtime identities rather than source-controlled credentials.

## Data Expectations

Page slugs are lowercase letters, digits, and hyphens. Dates use `YYYY-MM-DD`;
event timestamps use ISO 8601 UTC. Counts are non-negative integers.

Seed data is page keyed:

```ts
interface SeedData {
  pages: Record<string, {
    daily: Array<{
      date: string;
      views: number;
      clicks: number;
      shares: number;
    }>;
    links: Array<{
      id: string;
      label: string;
      clicks: number;
      rate?: number;
    }>;
    referrers: Array<{ source: string; visits: number }>;
    trends: {
      views: number;
      clicks: number;
      clickRate: number;
      shares: number;
    };
  }>;
}
```

## Local Persistence

Runtime files:

```text
local/data/analytics.json
local/data/visits.json
```

Configuration and event writes are serialized in-process to avoid lost updates.
This is appropriate for local development and single-process demos. A
multi-instance provider should use conditional or transactional writes.
