# Migrating to Cloud - AWS Blocks Backend Prompt

> Purpose: Replace local JSON mock services with AWS Blocks while making
> collections, analytics, and visit metrics private to each authenticated user.
> Public collection URLs remain accessible without authentication.

---

You are an expert TypeScript developer migrating a Next.js application's
backend from local JSON file mocks to AWS Blocks. Follow the AWS Blocks skill
rigorously.

<skill>
Load and follow: .agents/skills/SKILL.md
</skill>

<task>
Replace the local JSON mock services in `src/lib/services/local/` with AWS
Blocks implementations. The existing service interfaces in
`src/lib/services/interfaces/` are the contract and MUST remain unchanged.

Every authenticated user must own an isolated set of link pages/collections,
analytics records, and visit metrics. A user must never be able to list, read,
update, delete, reset, or clear another user's private records.

Public pages still resolve by globally unique slug. Public visitors can load a
page and track page views, link clicks, and shares without signing in.

Keep the frontend's design and workflows unchanged. Make only the minimal
frontend, route, and service-adapter changes required to separate protected
owner lookups from public slug lookups and to redirect admin users to their own
default collection. The service registry remains the provider registration
point.
</task>

<architecture>
1. **Backend runtime**: AWS Blocks (`aws-blocks/index.ts`)
2. **API layer**: ApiNamespace with methods matching the existing service
   contracts
3. **Auth**: AuthBasic; use the authenticated user's stable `userId` as the
   ownership key
4. **Data - Link pages**: DistributedTable with owner partitions and global
   public-slug reservation records
5. **Data - Analytics**: DistributedTable with `ownerId` on every record and
   an owner index for scoped reset/query operations
6. **Data - Visit events**: DistributedTable with `ownerId` on every event and
   an owner/time index for scoped metrics and clearing
7. **Hosting**: Blocks Hosting for the Next.js frontend
</architecture>

<ownership_model>
- Public page slugs are globally unique because `/:slug` has no user namespace.
- Store each user's configuration and pages under an owner partition such as:
  - `USER#<ownerId> / CONFIG`
  - `USER#<ownerId> / PAGE#<slug>`
- Store a global slug reservation such as `SLUG / <slug>` containing
  `ownerId`. Public reads resolve the reservation first, then fetch the page
  from its owner partition.
- Keep a platform configuration record for `/` and system-owned public demo
  pages. System pages must not appear in any user's admin page list.
- Acquire slug reservations with `ifNotExists`. If page creation fails after
  reservation, release only the reservation owned by that user.
- Owner-scoped reads must derive `ownerId` from
  `auth.requireAuth(context)`. Never accept an owner ID from request input.
- `updatePage` and `deletePage` must fetch the page from the authenticated
  owner's partition. A slug owned by someone else behaves as not found.
- Analytics and visit records must store the resolved page owner. Owner-level
  query/reset/clear operations must use an owner key or owner GSI, not a global
  table scan.
- Deleting a page must remove its owned analytics/events and release its slug
  without deleting records belonging to a later owner of that slug.
</ownership_model>

<existing_interfaces>
The following interfaces are the contract. AWS Blocks implementations MUST
satisfy them exactly.

### LinkStore (`src/lib/services/interfaces/link-store.interface.ts`)

```typescript
interface LinkStore {
  getConfiguration(): Promise<LinkConfiguration>;
  getPages(): Promise<PageSummary[]>;
  getPage(slug: string): Promise<PageConfiguration | null>;
  getDefaultPage(): Promise<PageConfiguration>;
  getEnabledLinks(slug?: string): Promise<LinkStoreSnapshot>;
  getLinkById(pageSlug: string, id: string): Promise<LinkEntry | null>;
  createPage(page: PageConfiguration): Promise<PageConfiguration>;
  updatePage(slug: string, page: PageConfiguration): Promise<PageConfiguration>;
  deletePage(slug: string): Promise<boolean>;
}
```

### AnalyticsStore (`src/lib/services/interfaces/analytics-store.interface.ts`)

```typescript
interface AnalyticsStore {
  query(input?: AnalyticsQuery): Promise<AnalyticsSummary>;
  upsertDailySnapshot(pageSlug: string, point: AnalyticsPoint): Promise<void>;
  resetFromSeed(): Promise<void>;
}
```

### VisitTracker (`src/lib/services/interfaces/visit-tracker.interface.ts`)

```typescript
interface VisitTracker {
  track(input: TrackVisitInput): Promise<VisitEvent>;
  getMetrics(input?: VisitMetricsQuery): Promise<VisitMetrics>;
  clear(): Promise<void>;
}
```
</existing_interfaces>

<authentication_matrix>
Authenticated and owner-scoped:

- `getConfiguration`
- `getPages`
- `getPage`
- `getDefaultPage`
- `createPage`
- `updatePage`
- `deletePage`
- `query`
- `upsertDailySnapshot`
- `resetFromSeed`
- `getMetrics`
- `clear`

Public:

- `getEnabledLinks`
- `getLinkById`
- `track`

Public methods resolve the page owner from the global slug reservation.
`track` must reject unknown page slugs and unknown link IDs for click events.
</authentication_matrix>

<implementation_plan>
Before writing code, analyze every interface method and present a plan:

1. Map each method to its AWS Blocks building block and authentication mode.
2. Design the pages table keys for owner lists, owner page lookup, per-user
   default pages, and global public slug lookup.
3. Design analytics keys/indexes for owner isolation, page filtering, date
   ranges, and reset.
4. Design visit keys/indexes for public event writes, owner/page filtering,
   time ranges, metrics, and clear.
5. Define conditional-write and rollback behavior for global slug reservations.
6. Map `src/lib/config/links.json` and
   `src/lib/services/local/data/seed-data.json` to system-owned public seeds and
   isolated per-user starter copies.
7. Identify the minimal existing frontend/route files that must change so
   public routes do not call authenticated owner methods.
8. Define a two-user test proving read/write/analytics/event isolation.

Present the plan and wait for approval before implementing.
</implementation_plan>

<migration_steps>
After approval, execute in this order:

1. **Scaffold AWS Blocks**
   - Scaffold into a temporary directory.
   - Copy only `aws-blocks/` into the project root.
   - Merge workspace configuration, dependencies, and scripts into the root
     `package.json`.
   - Do NOT overwrite `tsconfig.json`, `.gitignore`, or `next.config.ts`.

2. **Build the backend in `aws-blocks/index.ts`**
   - Create a Scope and AuthBasic instance.
   - Create pages, analytics, and visits DistributedTables.
   - Add owner keys and owner indexes described above.
   - Create an ApiNamespace exposing the interface methods.
   - Gate every protected method with `auth.requireAuth(context)`.
   - Resolve public pages and event ownership through slug reservations.

3. **Create Blocks service implementations**
   - Create `src/lib/services/blocks/link-store.blocks.ts`.
   - Create `src/lib/services/blocks/analytics-store.blocks.ts`.
   - Create `src/lib/services/blocks/visit-tracker.blocks.ts`.
   - Call the API from `import { api } from 'aws-blocks'`.
   - Use authenticated server calls for every method in the protected matrix.

4. **Update ownership-sensitive consumers**
   - Public `/:slug` rendering and metadata must use `getEnabledLinks(slug)`,
     not the protected `getPage(slug)`.
   - Tracking validation must use public slug/link resolution.
   - Admin layouts must reject slugs not returned by the current user's
     `getPages()`.
   - `/admin` and section redirects must load the authenticated user's default
     page rather than hardcoding `home`.
   - Preserve existing components, styling, accessibility, and visual design.

5. **Swap the service registry**
   - Update `src/lib/services/index.ts` to register `./blocks/` providers.
   - Keep local implementations as fallback documentation.

6. **Migrate seed behavior**
   - Add an idempotent `aws-blocks/scripts/seed.ts`.
   - Seed system-owned demo pages for `/` and public sample URLs.
   - On a user's first authenticated access, create deterministic,
     globally-unique copies of the starter collections for that user.
   - Seed analytics under the same user and rewritten page slugs.
   - Never copy arbitrary legacy/shared runtime pages into every user account.
   - Running `npm run seed` repeatedly must not duplicate records.

7. **Verify**
   - Run `npm run seed` twice.
   - Run `npm run lint` and `npm run build`.
   - Run the visual check using the authenticated user's discovered default
     slug; do not hardcode a shared admin slug.
   - Leave `npm run dev` serving the app and Blocks backend on port 3000.
</migration_steps>

<two_user_verification>
Create and authenticate User A and User B in separate sessions, then prove:

1. Their `getPages()` results contain distinct slugs and only their records.
2. User A cannot read, update, or delete a page owned by User B.
3. Both users' public pages remain accessible without authentication.
4. A tracked event for User A's page appears only in User A's metrics.
5. User A cannot query or upsert analytics for User B's page.
6. `resetFromSeed()` resets only the caller's analytics.
7. `clear()` clears only the caller's visit events.
8. Creating/deleting a temporary page does not affect the other user's list.
</two_user_verification>

<constraints>
- NEVER change the existing service interface contracts.
- NEVER use raw AWS SDK calls; use AWS Blocks building blocks only.
- NEVER edit generated files (`index.cdk.ts`, `index.handler.ts`, `client.js`).
- DO NOT add local-development environment variables; Blocks supplies local
  mocks.
- DO NOT remove the local service implementations.
- NEVER trust an owner ID supplied by a client.
- NEVER use a global scan to implement user-visible list, reset, metrics, or
  clear operations.
- Public slugs must remain globally unique.
- Dates use `YYYY-MM-DD`; timestamps use ISO 8601 UTC.
- Keep frontend changes narrowly scoped and visually unchanged.
</constraints>

<acceptance_criteria>
- [ ] Every authenticated user sees only their own collections.
- [ ] Cross-user page reads, updates, and deletes are denied or return not found.
- [ ] Analytics queries, upserts, and resets are isolated by owner.
- [ ] Visit metrics and clearing are isolated by owner.
- [ ] Public visitor pages load without authentication through globally unique
      slugs.
- [ ] Public click/page-view/share tracking stores the resolved page owner.
- [ ] New users receive isolated starter collections and seeded analytics.
- [ ] System demo pages do not appear in user admin lists.
- [ ] Page CRUD works through the existing admin UI.
- [ ] Admin routes require AuthBasic and redirect to the caller's default page.
- [ ] `npm run dev` serves frontend and Blocks locally on port 3000.
- [ ] `npm run seed` is idempotent.
- [ ] `npm run build` completes without TypeScript errors.
- [ ] The two-user isolation verification passes.
- [ ] `npm run deploy` deploys the full stack when AWS credentials are
      configured.
</acceptance_criteria>
