# Migrating to Cloud — AWS Blocks Backend Prompt

> Purpose: Replace local JSON mock services with AWS Blocks building blocks. The frontend must not change.

---

You are an expert TypeScript developer migrating a Next.js application's backend from local JSON file mocks to AWS Blocks. You follow the AWS Blocks skill at `.agents/skills/aws-blocks-development/` rigorously.

<skill>
Load and follow: .agents/skills/aws-blocks-development/SKILL.md
</skill>

<task>
Replace the local JSON mock services in `src/lib/services/local/` with AWS Blocks implementations. The existing service interfaces in `src/lib/services/interfaces/` are the contract. The service registry (`src/lib/services/index.ts`) is the only file that should change in the existing codebase.

The frontend, routing, components, and design must remain untouched. The only consumer-facing change is that data now lives in AWS instead of local JSON files.
</task>

<architecture>
1. **Backend runtime**: AWS Blocks (`aws-blocks/index.ts`)
2. **API layer**: ApiNamespace with methods that mirror the existing service interface contracts
3. **Auth**: AuthBasic for admin routes (analytics dashboard, page management)
4. **Data — Link pages**: DistributedTable (stores page configurations, link entries, and metadata)
5. **Data — Analytics**: DistributedTable (stores daily aggregate snapshots per page slug and date)
6. **Data — Visit events**: DistributedTable (stores raw page-view, link-click, and share events for real-time metrics)
7. **Hosting**: Blocks Hosting for the Next.js frontend
</architecture>

<existing_interfaces>
The following interfaces are the contract. Your AWS Blocks implementations MUST satisfy them exactly.

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

<implementation_plan>
Before writing any code, analyze each interface method and produce a plan:

1. For each method, determine which AWS Blocks building block serves it
2. Design the key schema for each DistributedTable to support the query patterns (date ranges, page slug filtering, link ID lookups)
3. Determine which methods need authentication (admin-only operations like createPage, updatePage, deletePage, resetFromSeed, clear) vs. public (getPage, getEnabledLinks, track)
4. Map the seed data from `src/lib/services/local/data/seed-data.json` to the new table schemas

Present the plan. Wait for approval before implementing.
</implementation_plan>

<migration_steps>
After the plan is approved, execute in this order:

1. **Scaffold AWS Blocks into the project**
   - Scaffold into a temp directory
   - Copy only the `aws-blocks/` folder into the project root
   - Merge workspace configuration and scripts into root `package.json`
   - Do NOT overwrite `tsconfig.json`, `.gitignore`, or `next.config.ts`

2. **Build the backend in `aws-blocks/index.ts`**
   - Create a Scope
   - Add AuthBasic for admin authentication
   - Create DistributedTable instances for pages, analytics, and visits
   - Create an ApiNamespace that exposes methods matching the three interfaces
   - Gate admin methods with `auth.requireAuth(context)`

3. **Create frontend service implementations**
   - Create `src/lib/services/blocks/link-store.blocks.ts` implementing LinkStore
   - Create `src/lib/services/blocks/analytics-store.blocks.ts` implementing AnalyticsStore
   - Create `src/lib/services/blocks/visit-tracker.blocks.ts` implementing VisitTracker
   - Each implementation calls the ApiNamespace methods from the `'aws-blocks'` workspace package

4. **Swap the service registry**
   - Update `src/lib/services/index.ts` to import from `./blocks/` instead of `./local/`
   - Keep the local implementations in place (they remain as fallback documentation)

5. **Seed data migration**
   - Write a seed script at `aws-blocks/scripts/seed.ts` that reads `seed-data.json` and populates the DistributedTables
   - The script must be idempotent (safe to run multiple times)

6. **Verification**
   - `npm run dev` starts both the Next.js frontend and the AWS Blocks local dev server
   - All existing pages render correctly with data from Blocks
   - Admin routes require login via AuthBasic
   - Analytics dashboard shows seeded data
   - Click tracking writes to the visits table
   - `npm run build` passes without errors
</migration_steps>

<constraints>
- NEVER modify files in `src/app/`, `src/components/`, or `src/styles/`
- NEVER change the existing service interface contracts
- NEVER use raw AWS SDK calls — use only AWS Blocks building blocks
- NEVER edit auto-generated files (`index.cdk.ts`, `index.handler.ts`, `client.js`)
- DO NOT add environment variables for local development — Blocks handles local mocks automatically
- DO NOT remove the local implementations — keep them for reference and fallback
- All dates use `YYYY-MM-DD` format, timestamps use ISO 8601 UTC
- Import the frontend client as `import { api } from 'aws-blocks'` (workspace package)
</constraints>

<acceptance_criteria>
- [ ] All existing frontend functionality works unchanged
- [ ] `npm run dev` starts both frontend and AWS Blocks local server on port 3000
- [ ] Admin routes (page management, analytics dashboard) require AuthBasic login
- [ ] Public visitor pages load without authentication
- [ ] Click tracking persists events to DistributedTable
- [ ] Analytics queries return correct aggregations by date range
- [ ] Page CRUD operations (create, read, update, delete) work through the admin UI
- [ ] `npm run build` completes without TypeScript errors
- [ ] Seed script populates tables with development data
- [ ] `npm run deploy` deploys the full stack to AWS (when credentials are configured)
</acceptance_criteria>
