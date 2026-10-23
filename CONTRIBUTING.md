# Contributing

This is a small project with a deliberately narrow set of conventions. Reading
this file and `AGENTS.md` first will save you a round of review — `AGENTS.md` is
written for coding agents, but every rule in it applies to people too.

## Getting set up

```bash
npm install
npm run dev:api
```

Open <http://localhost:3000>.

Use `dev:api` for anything that touches sign-in. It runs the AWS Blocks dev
server on port 3000 and Next on 3100, and fronts Next so both share one origin —
which is what the session cookie requires. `npm run dev` starts Next alone: the
UI renders, but every API call fails.

You do not need an AWS account to work on this. In development the Cognito
confirmation code is printed to the dev server log and written to
`.bb-data/some-useful-links-auth/last-code.json`, so sign-up works with no email
provider and no cloud resources.

## Before you open a pull request

Run the checks that match what you touched:

| Change | Command |
| --- | --- |
| `links.json` or its schema | `npm run validate:links` |
| TypeScript or behaviour | `npm run lint` |
| Routes, dependencies, shared architecture | `npm run build` |
| Anything visual | `npm run build`, then `node scripts/visual-check.mjs` |

`npm run lint` is `tsc --noEmit`. There is no ESLint config and no unit-test
suite — the strict compiler and the build are the gates.

Never run `npm run deploy`, `npm run destroy`, `npm run sandbox` or
`npm run sandbox:destroy` as part of ordinary development. They create, mutate
or delete real billable AWS resources, and `destroy` is irreversible.

## Things that will get a change sent back

- **Crossing the public/owner read split.** Public routes call
  `getEnabledLinks`, `getLinkById` and the tracking path, which send no session.
  Everything else forwards the session cookie so the backend derives the owner
  from it. A public route calling an owner-scoped read breaks for anonymous
  visitors — this split is load-bearing.
- **Importing a service implementation directly.** Import from
  `@/lib/services`. `src/lib/services/index.ts` is the only place a provider is
  named; `src/lib/services/local/*` is kept as a reference for the contracts and
  is not wired up.
- **Adding identifying data to analytics.** No IP addresses, user agents, full
  referrer URLs, or per-visitor identifiers, and `country` stays in its own
  table rather than moving onto the visit event. Those omissions are the privacy
  position, and a convenient extra field quietly removes it.
- **Raw AWS SDK calls.** Use the AWS Blocks building blocks.
- **Trusting an owner ID from request input.** Derive it from the verified
  session, always.
- **Reducing accessibility.** Accessible names, visible focus, keyboard
  operation, reduced-motion support and computed contrast are existing
  behaviour, not aspirations. Appearance colours are deliberately not free-form:
  ink is derived to clear 4.5:1 against its surface so a user cannot configure
  an unreadable page.
- **Unrelated refactors** bundled into a focused change, and generated-file
  churn (`.open-next/`, `cdk.out/`, runtime analytics JSON).

## Style

Follow what is already there rather than importing your own preferences.

- React Server Components by default; `"use client"` only where browser APIs,
  state, effects, event handlers, Canvas or charts genuinely require it.
- Strict TypeScript — no `any`, no unchecked casts, no duplicated domain types.
- Reuse existing components and Lucide icons before adding new primitives.
- Use the `@/*` alias for imports under `src`.
- `DESIGN_SPEC.md` and `design-previews/` are the visual source of truth.
  Preserve the Manrope font, the theme tokens, the spacing scale and the
  existing breakpoints.
- Check visitor pages at 390px and admin views at desktop width. No horizontal
  overflow.

## Commits

One logical purpose per commit, kept small. A one-sentence summary, a blank
line, then a short explanation of what changed and how you verified it.

## Documentation map

- `README.md` — features, setup, architecture, deployment.
- `AGENTS.md` — conventions and verification rules, written for coding agents.
- `DESIGN_SPEC.md` — the visual source of truth. Live reference.
- `src/lib/services/README.md` — the data-layer contract.
- `BUILD_PROMPT.md` and `MIGRATING_TO_CLOUD_PROMPT.md` — historical records of
  the original build and the cloud migration. Useful for rationale, not
  instructions.
