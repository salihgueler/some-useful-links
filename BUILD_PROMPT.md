# Some Useful Links — Technical Build Prompt

> Purpose: Build a link sharing platform with Next.js from the design spec.

---

You are an expert Next.js developer building a production-ready application. You follow React and Next.js best practices rigorously.

<skill>
Load and follow: https://www.skills.sh/vercel-labs/agent-skills/vercel-react-best-practices
</skill>

<task>
Build "Some Useful Links" — a LinkTree-style web application using Next.js with SSR enabled. The complete visual design specification is in `DESIGN_SPEC.md` and reference screenshots are in the `design-previews/` folder. Implement the design pixel-perfectly according to that spec.

All backend infrastructure must be local mocks — no cloud dependencies. The mocks must be documented clearly enough that another AI agent or developer can swap them for any cloud provider (AWS, GCP, Azure, etc.) without restructuring the app.
</task>

<architecture>
1. **Framework**: Next.js (App Router) with Server-Side Rendering enabled
2. **Rendering Strategy**:
   - Visitor link page: SSR (dynamic, fast first paint, SEO-friendly)
   - Analytics dashboard: SSR with client-side interactivity for charts and date filters
   - Share image generation: Client-side Canvas API (runs in browser)
3. **Styling**: Tailwind CSS with a custom theme matching the design spec's color palette, typography, spacing, and radius tokens
4. **Font**: Manrope via `next/font/google` with the fallback stack from the spec
5. **State Management**: React Server Components where possible; client components only where interactivity is required
6. **Backend**: Local mocks only — no cloud services, no external APIs, no deployment configuration
</architecture>

<link_configuration_schema>
The link configuration file (`src/lib/config/links.json`) must conform to this JSON Schema. Include the schema file at `src/lib/config/links.schema.json` so agents and CI tools can validate it.

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "title": "Some Useful Links - Link Configuration",
  "description": "Schema for the link entries displayed on the visitor page. Validated at build time and by agents before modification.",
  "type": "object",
  "required": ["meta", "links"],
  "properties": {
    "meta": {
      "type": "object",
      "description": "Site-level metadata",
      "required": ["title", "subtitle", "url"],
      "properties": {
        "title": {
          "type": "string",
          "description": "Page title displayed below the avatar",
          "default": "Some Useful Links"
        },
        "subtitle": {
          "type": "string",
          "description": "Short tagline below the title (max 80 chars)",
          "maxLength": 80
        },
        "url": {
          "type": "string",
          "format": "uri",
          "description": "Canonical public URL of the deployed page (used for QR code generation)"
        },
        "avatar": {
          "type": "string",
          "description": "Path to avatar image relative to /public, or an external URL",
          "default": "/avatar.svg"
        }
      },
      "additionalProperties": false
    },
    "links": {
      "type": "array",
      "description": "Ordered list of links displayed on the page",
      "minItems": 1,
      "maxItems": 20,
      "items": {
        "type": "object",
        "required": ["id", "label", "url", "icon"],
        "properties": {
          "id": {
            "type": "string",
            "pattern": "^[a-z0-9-]+$",
            "description": "Unique identifier for analytics tracking (lowercase, hyphens only)"
          },
          "label": {
            "type": "string",
            "description": "Display text on the link button",
            "minLength": 1,
            "maxLength": 40
          },
          "caption": {
            "type": "string",
            "description": "Optional one-line description below the label",
            "maxLength": 60
          },
          "url": {
            "type": "string",
            "format": "uri",
            "description": "Destination URL (https, http, or mailto)"
          },
          "icon": {
            "type": "object",
            "description": "Icon tile displayed to the left of the label",
            "required": ["emoji"],
            "properties": {
              "emoji": {
                "type": "string",
                "description": "Emoji character for the icon tile",
                "minLength": 1,
                "maxLength": 2
              },
              "backgroundColor": {
                "type": "string",
                "pattern": "^#[0-9A-Fa-f]{6}$",
                "description": "Hex color for the icon tile background. Defaults to a rotating pastel from the palette."
              }
            },
            "additionalProperties": false
          },
          "enabled": {
            "type": "boolean",
            "description": "If false, the link is hidden from visitors but retained in config",
            "default": true
          },
          "order": {
            "type": "integer",
            "description": "Optional explicit sort order. If omitted, array order is used.",
            "minimum": 0
          }
        },
        "additionalProperties": false
      }
    }
  },
  "additionalProperties": false
}
```

### Implementation requirements for the schema:
1. Save the schema at `src/lib/config/links.schema.json`
2. Save the link data at `src/lib/config/links.json` (with a `$schema` reference pointing to the schema file)
3. Add a TypeScript type generated from or mirroring this schema at `src/lib/config/links.types.ts`
4. Validate the config at build time — add a script in `package.json` (`"validate:links"`) that runs `ajv` or a simple TS check against the schema
5. Include a sample `links.json` with 5 placeholder entries matching the schema
6. Document in the README how agents should modify links: edit `links.json`, run `npm run validate:links`, restart dev server
</link_configuration_schema>

<backend_infrastructure>
All backend concerns must be implemented as **local mocks behind well-defined interfaces**. Each service has:
- A TypeScript interface (contract)
- A local mock implementation
- A dedicated README documenting the interface, expected behavior, and migration guidance

### Data Layer

```
src/lib/services/
├── interfaces/
│   ├── analytics-store.interface.ts    # Contract for analytics read/write
│   ├── link-store.interface.ts         # Contract for link data retrieval
│   └── visit-tracker.interface.ts      # Contract for visit/click tracking
├── local/
│   ├── analytics-store.local.ts        # JSON file-based analytics store
│   ├── link-store.local.ts             # Reads from links.json via the schema-validated config
│   ├── visit-tracker.local.ts          # In-memory + JSON file tracker
│   └── data/                           # Local JSON data files (gitignored runtime data)
│       ├── analytics.json
│       ├── visits.json
│       └── seed-data.json              # Sample data for development
├── index.ts                            # Service registry — single swap point
└── README.md                           # Migration guide
```

### Interface Requirements

Each interface file must include:
1. Full TypeScript interface with JSDoc on every method
2. Input/output types clearly defined
3. Expected error cases documented
4. Example usage in comments

### Local Mock Implementations

- **Link Store**: Reads link configuration from `src/lib/config/links.json` (validated against schema). Returns typed link objects.
- **Analytics Store**: Reads/writes to a local `data/analytics.json` file. Supports queries by date range, link ID, and aggregation type.
- **Visit Tracker**: Captures click events (link name, timestamp, referrer, user-agent) and page visits. Writes to `data/visits.json`. Provides methods to query totals, per-link counts, CTR, and top referrers.

### Service Registry (`index.ts`)

A single file that exports the active implementation for each interface. To migrate to a cloud provider, an agent or developer only needs to:
1. Create a new implementation file (e.g., `analytics-store.aws.ts`)
2. Implement the interface
3. Update the import in `index.ts`

```typescript
// src/lib/services/index.ts
import { LocalAnalyticsStore } from './local/analytics-store.local';
import { LocalLinkStore } from './local/link-store.local';
import { LocalVisitTracker } from './local/visit-tracker.local';

// SWAP POINT: Replace these with cloud implementations
export const analyticsStore = new LocalAnalyticsStore();
export const linkStore = new LocalLinkStore();
export const visitTracker = new LocalVisitTracker();
```

### Migration README (`src/lib/services/README.md`)

This file must contain:
1. **Architecture overview** — diagram of how the app consumes services
2. **Interface reference** — summary of each interface, its methods, and data types
3. **Migration steps** — numbered checklist for swapping to a cloud provider:
   - Which files to create
   - Which file to update (just `index.ts`)
   - Environment variables to add
   - Data schema expectations (matches the interface types)
4. **Provider-specific hints** — brief notes on likely implementations:
   - AWS: DynamoDB for analytics, S3 for config, CloudWatch for tracking
   - GCP: Firestore, Cloud Storage, Cloud Functions
   - Azure: CosmosDB, Blob Storage, Application Insights
   - Generic: Any SQL database (Postgres, MySQL) with the same interface
5. **Seed data format** — schema of `seed-data.json` so cloud migrations can import initial data
</backend_infrastructure>

<design_reference>
All visual decisions — colors, typography, spacing, radii, component states, animations, and responsive breakpoints — are defined in `DESIGN_SPEC.md`. Do NOT deviate from it. When implementing any component, consult the spec for:
- Exact hex values, sizes, and weights
- All interaction states (default, hover, active, focus, disabled, visited)
- Animation timing and easing curves
- Responsive behavior at 390px, 600px, and 1024px breakpoints
- `prefers-reduced-motion` accommodations

Reference screenshots in `design-previews/`:
- `link-page.png` — Visitor page
- `dashboard.png` — Analytics dashboard
- `social-card.png` — Generated social share image
</design_reference>

<features>
### 1. Visitor Link Page (SSR)
- Centered card layout with avatar, title, subtitle, and "Curated with care" label
- Vertical stack of link buttons with icon tiles, labels, captions, and chevrons
- All link states per spec (hover lift, active press, focus ring, visited, disabled)
- Entrance animations with stagger (respect `prefers-reduced-motion`)
- "Share this page" primary button
- Footer with divider and copy

### 2. Analytics Dashboard (SSR + Client Interactivity)
- Protected admin route (environment variable password — no external auth service)
- Navigation tabs: Links, Analytics, Appearance
- Four KPI panels (views, clicks, CTR, shares)
- Clicks-over-time line chart (lightweight library: Recharts or Chart.js)
- Top-links table with click counts
- Traffic-source horizontal bars
- Date-range selector
- Live page preview panel
- All data fetched through the service interfaces (never directly reading JSON files from components)

### 3. Social Share Image Generator (Client-Side Canvas)
- Button triggers a modal (sheet on mobile, centered overlay on desktop)
- Generate a 1200×630px image using the Canvas API matching the spec:
  - Lavender left field (70%), teal right field (30%)
  - Logo and brand label upper-left
  - Large two-line headline center-left
  - Tagline with peach underline
  - QR code in white container (use `qrcode` library, pointing to canonical URL)
  - URL lower-left, "Curated · Updated weekly" lower-right
  - 64px safe margin on all edges
- Download as PNG button
- Copy shareable link button
- Loading, success, and error states per spec
</features>

<project_structure>
```
src/
├── app/
│   ├── layout.tsx              # Root layout, font loading, metadata
│   ├── page.tsx                # Visitor link page (SSR)
│   ├── admin/
│   │   ├── layout.tsx          # Admin layout with nav tabs
│   │   └── analytics/
│   │       └── page.tsx        # Analytics dashboard
│   └── api/
│       ├── track/route.ts      # Click and visit tracking endpoint
│       └── analytics/route.ts  # Analytics data retrieval
├── components/
│   ├── ui/                     # Reusable primitives (Button, Card, Modal, Badge)
│   ├── links/                  # LinkRow, LinkList, LinkIcon
│   ├── analytics/              # KPIPanel, ClickChart, TopLinks, SourceBars
│   ├── share/                  # ShareModal, CanvasGenerator, QRCode
│   └── layout/                 # Header, Footer, Avatar, NavTabs
├── lib/
│   ├── services/               # All backend infrastructure
│   │   ├── interfaces/         # TypeScript contracts
│   │   ├── local/              # Local mock implementations + data/
│   │   ├── index.ts            # Service registry (single swap point)
│   │   └── README.md           # Migration documentation
│   ├── config/
│   │   ├── links.json          # Link data (validated against schema)
│   │   ├── links.schema.json   # JSON Schema for link validation
│   │   └── links.types.ts      # TypeScript types mirroring the schema
│   ├── canvas.ts               # Social image generation utilities
│   └── config.ts               # Site-level configuration
├── styles/
│   └── globals.css             # Tailwind directives + custom properties
└── tailwind.config.ts          # Custom theme from DESIGN_SPEC
```
</project_structure>

<tailwind_theme>
Extend the Tailwind config to match the design spec exactly:
- Colors: primary (#5C4FB3), secondary (#BFECE6), lavender (#E8E4FB), accent (#FFB891), supporting (#FDEDBF), background (#F8F7FC), surface (#FFFFFF), ink (#2A2738), muted (#6C6878), border (#E5E2EC), positive (#186B61), positive-surface (#DFF4EC)
- Border radius: sm (10px), md (13px), lg (16px), xl (17px), 2xl (22px), 3xl (24px), full (50%)
- Spacing: follows the 4px base system (4, 8, 12, 16, 24, 32, 48, 64)
- Font family: Manrope with specified fallback stack
- Font sizes and weights: match the typography table in the spec
- Transitions: fast (160ms), default (200ms), modal (220ms), chart (500ms) — all ease-out
</tailwind_theme>

<implementation_rules>
1. Use Server Components by default. Add `"use client"` only for components requiring browser APIs, event handlers, or hooks.
2. All pages must be SSR — do NOT use `export const dynamic = "force-static"` or static generation.
3. Use `next/image` for any raster assets with proper width/height/alt.
4. Use `next/font/google` for Manrope — no external stylesheet links.
5. Metadata and Open Graph tags must be set via the Next.js Metadata API.
6. All interactive elements must be keyboard accessible with visible focus states (peach ring per spec).
7. Semantic HTML: use `<nav>`, `<main>`, `<section>`, `<article>`, `<footer>` appropriately.
8. Link configuration is read exclusively from `src/lib/config/links.json` — validated against the JSON Schema.
9. Animations must respect `prefers-reduced-motion` — use Tailwind's `motion-safe:` and `motion-reduce:` variants.
10. No layout shift — use fixed dimensions for skeletons matching final component sizes.
11. No deployment configuration — no `vercel.json`, no Docker, no CDK, no serverless config.
12. No external cloud services — all data is local. The app must run with `npm run dev` and nothing else.
13. Components must NEVER import from `./local/` directly — always import from the service registry (`../services/index`).
14. The `validate:links` script must pass before the dev server starts (add it to the `predev` script).
</implementation_rules>

<output_format>
Deliver:
1. All source files with the project structure above
2. A `README.md` with:
   - Setup instructions (`npm install` → `npm run dev`)
   - How to customize links (edit `links.json`, run validation, schema reference)
   - How to access the analytics dashboard
   - How the local mock system works
3. The service migration README at `src/lib/services/README.md`
4. The JSON Schema at `src/lib/config/links.schema.json`
5. A `package.json` with all required dependencies and scripts (`dev`, `build`, `validate:links`, `predev`)
6. Seed data in `src/lib/services/local/data/seed-data.json` so the app has realistic sample data on first run
7. Inline comments on non-obvious implementation decisions
</output_format>
