import {
  ApiError,
  ApiNamespace,
  AppSetting,
  AuthCognito,
  CronJob,
  Scope,
} from "@aws-blocks/blocks";
import { analyticsOperations, createAnalyticsTable, type AnalyticsPoint } from "./analytics-table";
import { appStatsOperations, createAppStatsTable } from "./app-stats-table";
import { buildAppStats } from "./app-stats-rollup";
import { pageOperations } from "./page-operations";
import { starterPage, starterSlug } from "./starter-page";
import { createVisitsTable, visitOperations, type VisitEventType } from "./visits-table";
import {
  countryOperations,
  createCountriesTable,
  normalizeCountry,
} from "./countries-table";
import { createPagesTable } from "./pages-table";
import {
  NotEligibleError,
  assertEligibleEmail,
  isEligibleEmail,
  normalizeEmail,
} from "./eligibility";

// For coding agents: Leave these comments in place for future reference.
// Read node_modules/@aws-blocks/blocks/README.md for all available Building Blocks
// Hover over Scope below to see the docstring with complete Building Block index

const scope = new Scope("some-useful-links");

/** Owner-partitioned page storage; see pages-table.ts for the key design. */
const pagesTable = createPagesTable(scope);
const pages = pageOperations(pagesTable);

/** Daily aggregates, owner-partitioned; see analytics-table.ts. */
const analyticsTable = createAnalyticsTable(scope);
const analytics = analyticsOperations(analyticsTable);

/** Raw visit events with TTL retention; see visits-table.ts. */
const visitsTable = createVisitsTable(scope);
const visits = visitOperations(visitsTable);

/** Day-granular visit origin; see countries-table.ts for why it is separate. */
const countriesTable = createCountriesTable(scope);
const countries = countryOperations(countriesTable);

/** Product-wide daily rollups for the operator view; see app-stats-table.ts. */
const appStatsTable = createAppStatsTable(scope);
const appStats = appStatsOperations(appStatsTable);

/**
 * The single account allowed to read app-wide statistics.
 *
 * Held as configuration rather than in source: it is a Cognito subject id, and
 * committing account identifiers to the repository is exactly what the project
 * rules forbid. The value is seeded at deploy time from OPERATOR_USER_SUB, the
 * same pattern HOSTING_CERTIFICATE_ARN already uses, and can be changed later
 * with put() without a redeploy.
 *
 * An unset variable becomes the empty string, which cannot equal any real
 * Cognito sub -- so a deploy that forgets to configure it denies everyone
 * rather than admitting anyone. The gate fails closed by construction.
 */
const operatorUserSub = new AppSetting(scope, "operatorUserSub", {
  value: process.env.OPERATOR_USER_SUB ?? "",
});

/**
 * Rebuilds the app-wide rollup nightly, at 00:10 Europe/Berlin.
 *
 * Off the hour on purpose: scheduled jobs cluster on exact hours, and the
 * minute costs nothing. Expressed in a named timezone rather than a fixed UTC
 * offset so it stays at local midnight across the CEST/CET switch instead of
 * drifting by an hour twice a year.
 *
 * The handler rewrites a trailing window from source on every run, which is
 * what makes it safe under EventBridge's at-least-once delivery -- a
 * redelivered invocation recomputes the same numbers instead of double-counting
 * them. It also means a day that was still in progress at run time is corrected
 * by the following night's run.
 */
new CronJob(scope, "appStatsRollup", {
  schedule: "cron(10 0 * * ? *)",
  timezone: "Europe/Berlin",
  description: "Aggregate per-owner analytics into app-wide daily totals",
  handler: async () => {
    // Existing rows are read first so earlier dates keep the totals they
    // recorded at the time; only today's row takes this run's snapshot.
    const existing = await appStats.range();
    const priorTotals = new Map(
      existing.map((day) => [
        day.date,
        { totalOwners: day.totalOwners, totalPages: day.totalPages },
      ]),
    );

    const days = await buildAppStats(
      analyticsTable,
      visitsTable,
      pagesTable,
      priorTotals,
    );
    for (const day of days) {
      await appStats.putDay(day);
    }
  },
});

const isProduction = process.env.NODE_ENV === "production";

/**
 * Authentication for Some Useful Links.
 *
 * signInWith: 'email' is a ONE-WAY DOOR. Cognito rejects the alias-shape
 * transition, so changing it later requires recreating the pool and every
 * account in it. It is correct here because every account is identified by a
 * confirmed email address.
 */
const auth = new AuthCognito(scope, "auth", {
  signInWith: "email",
  selfSignUp: true,
  // Optional TOTP only. EMAIL as an MFA type makes Cognito challenge every
  // sign-in with a mailed code, which would put routine sign-in behind email
  // deliverability into corporate inboxes -- the same dependency that already
  // gates sign-up confirmation. One point of failure there is enough.
  mfa: "optional",
  mfaTypes: ["TOTP"],
  passwordPolicy: {
    minLength: 12,
    requireDigits: true,
    requireSymbols: true,
    requireUppercase: true,
    requireLowercase: true,
  },
  // Shorter than the 400-day default, so a leaked or forgotten session on a
  // shared device stops working within a day.
  sessionTtlSeconds: 60 * 60 * 12,
  // Local mock only: surface confirmation codes in the dev server log so
  // sign-up can be exercised without an email provider. Never in production.
  ...(isProduction
    ? {}
    : {
        codeDelivery: async (username: string, code: string, purpose: string) => {
          console.log(`[auth:${purpose}] ${username} -> ${code}`);
        },
      }),
});

/**
 * Request context type, derived from the auth block rather than imported from
 * @aws-blocks/core, which is only an indirect dependency here.
 */
type RequestContext = Parameters<typeof auth.requireAuth>[0];

/**
 * eligibility.ts stays framework-free so it can be reasoned about and tested
 * on its own; the HTTP status is applied here at the API boundary.
 */
function notEligible(message = "Enter a valid email address") {
  return new ApiError(message, 403, { name: "NotEligible" });
}

function eligibleOrThrow(email: string): string {
  try {
    return assertEligibleEmail(email);
  } catch (error) {
    if (error instanceof NotEligibleError) throw notEligible();
    throw error;
  }
}

/**
 * JSON-RPC serialises an omitted positional parameter as null, so every
 * optional string param has to be normalised before it reaches a key
 * condition -- "A#slug#null" silently matches no rows rather than failing.
 */
function optionalString(value: string | null | undefined): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

/** Keeps only the origin: a full referrer URL can carry tokens in its query. */
function referrerOrigin(raw: string | null | undefined): string | undefined {
  if (typeof raw !== "string" || raw.length === 0) return undefined;
  try {
    return new URL(raw).origin;
  } catch {
    return undefined;
  }
}

/**
 * Authenticated AND holding a confirmed, well-formed email address.
 *
 * Checked on every call rather than trusted from sign-up, so an account
 * created out of band or with an unconfirmed address cannot act as an owner.
 */
async function requireEligible(context: RequestContext) {
  const user = await auth.requireAuth(context);
  const email = normalizeEmail(user.attributes.email ?? user.username);
  if (user.attributes.email_verified === "false") {
    throw notEligible("Confirm your email address first");
  }
  if (!isEligibleEmail(email)) {
    throw notEligible();
  }
  return { user, email };
}

/**
 * Authorization for the app-wide operator view.
 *
 * A second, narrower tier on top of requireEligible: every eligible user is an
 * owner of their own collections, but exactly one account may read numbers that
 * span all owners. Enforced here, at the data boundary, rather than in the page
 * -- so the RPC method cannot be reached directly even by someone who knows the
 * route exists.
 *
 * Reports "not found" rather than "forbidden" deliberately: a 403 confirms
 * there is an operator surface to attack, a 404 says nothing at all.
 */
async function requireOperator(context: RequestContext) {
  const { user } = await requireEligible(context);
  const operator = await operatorUserSub.get();
  if (!operator || user.userSub !== operator) {
    throw new ApiError("Not found", 404, { name: "NotFound" });
  }
  return { user };
}

/**
 * Every ApiNamespace method is a PUBLIC RPC endpoint by default.
 *
 * The raw auth state machine (auth.createApi()) is deliberately NOT exported:
 * it exposes every auth operation directly to the browser, which would bypass
 * the address normalisation below. Sign-up must go through this namespace.
 */
export const api = new ApiNamespace(scope, "api", (context) => ({
  /** Liveness probe. */
  async health() {
    return { ok: true, service: "some-useful-links" };
  },

  async signUp(email: string, password: string) {
    const eligible = eligibleOrThrow(email);
    const result = await auth.signUp(eligible, password, {}, context);
    return { isSignUpComplete: result.isSignUpComplete, nextStep: result.nextStep };
  },

  async confirmSignUp(email: string, code: string) {
    return auth.confirmSignUp(eligibleOrThrow(email), code, context);
  },

  async signIn(email: string, password: string) {
    return auth.signIn(eligibleOrThrow(email), password, context);
  },

  /**
   * Continues a sign-in that returned `continueSignIn`. With this pool's
   * configuration the only challenge reachable is an MFA code (TOTP), so this
   * takes the code directly rather than the full discriminated response union.
   * Add sibling methods if a new challenge type is enabled later.
   */
  async confirmSignIn(session: string, code: string) {
    return auth.confirmSignIn(session, { code }, context);
  },

  /**
   * Starts a password reset; Cognito mails a code.
   *
   * The block deliberately never reveals whether the account exists, so that
   * this endpoint cannot be used to enumerate addresses. This wrapper preserves
   * that: the only thing it will refuse is a MALFORMED ADDRESS, which is a
   * statement about the input itself and discloses nothing about accounts.
   */
  async resetPassword(email: string) {
    const result = await auth.resetPassword(eligibleOrThrow(email));
    return { isPasswordReset: result.isPasswordReset, nextStep: result.nextStep };
  },

  /**
   * Completes the reset with the mailed code and a new password. Cognito
   * enforces the pool's password policy here, so a weak new password is
   * rejected at the source rather than by a duplicate rule of our own.
   */
  async confirmResetPassword(email: string, code: string, newPassword: string) {
    await auth.confirmResetPassword(eligibleOrThrow(email), code, newPassword);
    return { ok: true };
  },

  async signOut() {
    await auth.signOut(context, { global: true });
    return { ok: true };
  },

  /** Current identity, or 401/403 if not signed in or not confirmed. */
  async me() {
    const { user, email } = await requireEligible(context);
    return { email, userSub: user.userSub };
  },

  // ---- Owner-scoped pages -------------------------------------------------
  // ownerId always comes from the verified session, never from the caller.

  async listPages() {
    const { user } = await requireEligible(context);
    return { pages: await pages.listPages(user.userSub) };
  },

  async getPage(slug: string) {
    const { user } = await requireEligible(context);
    return { page: (await pages.getPage(user.userSub, slug)) ?? null };
  },

  async createPage(slug: string, page: string, isDefault = false) {
    const { user } = await requireEligible(context);
    await pages.createPage(user.userSub, slug, page, isDefault);
    return { slug };
  },

  async updatePage(slug: string, page: string) {
    const { user } = await requireEligible(context);
    await pages.updatePage(user.userSub, slug, page);
    return { slug };
  },

  /**
   * Renames a collection and takes its history with it.
   *
   * The page move happens first, so a slug that is already taken fails before
   * any history is touched. Analytics aggregates and visit events both carry
   * the slug in their sort key, so they are rewritten rather than updated in
   * place -- without this the history would be orphaned: invisible under the
   * new slug and unreachable under the old one.
   */
  async renamePage(slug: string, nextSlug: string, page: string) {
    const { user } = await requireEligible(context);
    await pages.renamePage(user.userSub, slug, nextSlug, page);
    const movedAggregates = await analytics.rename(user.userSub, slug, nextSlug);
    const movedEvents = await visits.rename(user.userSub, slug, nextSlug);
    const movedCountries = await countries.rename(user.userSub, slug, nextSlug);
    return { slug: nextSlug, movedAggregates, movedEvents, movedCountries };
  },

  async deletePage(slug: string) {
    const { user } = await requireEligible(context);
    return { deleted: await pages.deletePage(user.userSub, slug) };
  },

  // ---- Owner-scoped analytics ---------------------------------------------

  async queryAnalytics(
    slug: string,
    startDate?: string | null,
    endDate?: string | null,
  ) {
    const { user } = await requireEligible(context);
    return {
      points: await analytics.range(
        user.userSub,
        slug,
        optionalString(startDate),
        optionalString(endDate),
      ),
    };
  },

  async upsertDailySnapshot(slug: string, point: AnalyticsPoint) {
    const { user } = await requireEligible(context);
    await analytics.upsertDaily(user.userSub, slug, point);
    return { date: point.date };
  },

  async resetAnalytics(slug: string) {
    const { user } = await requireEligible(context);
    return { deleted: await analytics.reset(user.userSub, slug) };
  },

  /**
   * Gives a brand-new owner a starter collection. Idempotent in two ways:
   * it no-ops when the owner already has any collection, and the slug is
   * derived from the owner rather than random, so a repeat call resolves to
   * the same reservation instead of creating a second collection.
   */
  async seedStarterCollection() {
    const { user } = await requireEligible(context);
    const existing = await pages.listPages(user.userSub);
    if (existing.length > 0) {
      return { created: false, slug: existing[0].slug, reason: "already-seeded" };
    }

    const slug = starterSlug(user.userSub);
    const holder = await pages.resolveSlugOwner(slug);
    if (holder && holder !== user.userSub) {
      // Derived slugs collide only on a UUID prefix clash. Rather than silently
      // widening the derivation, report it: the owner can pick their own slug.
      throw new ApiError(
        "Could not reserve a starter address; please choose one",
        409,
        { name: "StarterSlugTaken" },
      );
    }

    await pages.createPage(
      user.userSub,
      slug,
      JSON.stringify(starterPage(slug)),
      true,
    );
    return { created: true, slug };
  },

  // ---- Public --------------------------------------------------------------

  /** No auth: public link pages are readable by anyone. */
  async getPublicPage(slug: string) {
    return { page: (await pages.getPublicPage(slug)) ?? null };
  },

  /**
   * No auth: public pages record their own views and clicks.
   *
   * The owner is resolved from the slug reservation, so an event for an
   * unclaimed slug is rejected instead of being filed under nobody. The caller
   * supplies neither an owner nor a timestamp.
   */
  async track(
    slug: string,
    type: VisitEventType,
    linkId?: string | null,
    referrer?: string | null,
    country?: string | null,
  ) {
    // JSON-RPC positional params carry an absent value as null, and the record
    // schema accepts undefined but not null. Normalise before validating.
    const link = typeof linkId === "string" && linkId.length > 0 ? linkId : undefined;
    // Reduce to the origin HERE, not only in the Next route handler: this
    // endpoint is publicly callable, so a control that lives upstream of it is
    // bypassable. Full referrer URLs can carry tokens in the query string.
    const ref = referrerOrigin(referrer);

    const ownerId = await pages.resolveSlugOwner(slug);
    if (!ownerId) {
      throw new ApiError("Unknown page slug", 400, { name: "UnknownPage" });
    }
    if (type === "link-click" && !link) {
      throw new ApiError("linkId is required for link-click events", 400, {
        name: "MissingLinkId",
      });
    }
    if (link) {
      // Verify the link exists on the page. This has to happen here: the public
      // route cannot check it without an owner-scoped read, and without it any
      // caller could invent link IDs and pollute an owner's per-link metrics.
      const raw = await pages.getPublicPage(slug);
      const exists = raw
        ? (JSON.parse(raw) as { links?: Array<{ id?: string }> }).links?.some(
            (candidate) => candidate.id === link,
          )
        : false;
      if (!exists) {
        throw new ApiError("Unknown link ID", 400, { name: "UnknownLink" });
      }
    }
    const { id } = await visits.track(ownerId, slug, { type, linkId: link, referrer: ref });
    // Recorded separately and only to the day, so no country is ever paired with
    // a visit's timestamp or linkId. Never receives an IP address.
    await countries.record(ownerId, slug, normalizeCountry(country));
    return { ok: true, eventId: id };
  },

  // ---- Owner-scoped visit metrics -----------------------------------------

  async visitMetrics(
    slug: string,
    startDate?: string | null,
    endDate?: string | null,
  ) {
    const { user } = await requireEligible(context);
    return await visits.metrics(
      user.userSub,
      slug,
      optionalString(startDate),
      optionalString(endDate),
    );
  },

  /** Visit counts per country for a date range, most visits first. */
  async queryCountries(
    slug: string,
    startDate?: string | null,
    endDate?: string | null,
  ) {
    const { user } = await requireEligible(context);
    return {
      countries: await countries.counts(
        user.userSub,
        slug,
        optionalString(startDate),
        optionalString(endDate),
      ),
    };
  },

  async clearVisits(slug: string) {
    const { user } = await requireEligible(context);
    return { cleared: await visits.clear(user.userSub, slug) };
  },

  // ---- Operator-only: the whole app ---------------------------------------

  /**
   * App-wide daily totals across every owner, for the single operator account.
   *
   * Reads the nightly rollup, so this is one query against one partition -- the
   * cross-owner scan happens in the CronJob, never here. Numbers can therefore
   * be up to a day stale, which is the intended trade: a product-level view
   * does not need to be live, and paying for a scan per page load would be
   * absurd.
   */
  async appStats(startDate?: string | null, endDate?: string | null) {
    await requireOperator(context);
    return {
      days: await appStats.range(
        optionalString(startDate),
        optionalString(endDate),
      ),
    };
  },
}));
