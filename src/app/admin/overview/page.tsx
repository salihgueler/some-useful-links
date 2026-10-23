import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AppStatsView } from "@/components/analytics/AppStatsView";
import { requireOwnerPage } from "@/lib/auth/require-owner";
import { appStatsStore } from "@/lib/services";
import type { AppStatsDay } from "@/lib/services/interfaces/app-stats.interface";

/**
 * App-wide statistics for the single operator account.
 *
 * Two layers of gating, and the second is the real one:
 *
 *  1. requireOwnerPage() sends anonymous visitors to /login, so this behaves
 *     like every other admin surface.
 *  2. The backend compares the caller's Cognito sub against the configured
 *     operator and rejects everyone else. That check is authoritative because
 *     it lives with the data -- this page cannot grant itself access by
 *     forgetting to ask.
 *
 * Any rejection becomes notFound(), so a signed-in non-operator sees the same
 * 404 as a bad URL. A 403 would confirm the page exists and is worth attacking.
 */

export const metadata: Metadata = {
  title: "Whole app",
  // Belt and braces alongside the auth gate: even if a URL leaks, keep it out
  // of search results.
  robots: { index: false, follow: false },
};

const DEFAULT_WINDOW_DAYS = 35;

function subtractDays(from: Date, days: number) {
  const value = new Date(from);
  value.setUTCDate(value.getUTCDate() - (days - 1));
  return value.toISOString().slice(0, 10);
}

export default async function WholeAppPage() {
  await requireOwnerPage();

  let days: AppStatsDay[];
  try {
    const now = new Date();
    const result = await appStatsStore.query({
      startDate: subtractDays(now, DEFAULT_WINDOW_DAYS),
      endDate: now.toISOString().slice(0, 10),
    });
    days = result.days;
  } catch {
    // Not the operator, or the rollup is unreachable. Both read as "no such
    // page": this fails closed rather than rendering an empty dashboard that
    // implies the surface exists.
    notFound();
  }

  const generatedAt = days.at(-1)?.generatedAt;

  return (
    <main className="app-stats-page">
      <header className="app-stats-header">
        <h1 className="app-stats-title">Whole app</h1>
        <p className="app-stats-sub">
          Every owner and every collection, combined. Rebuilt nightly.
          {generatedAt ? (
            <>
              {" "}
              <span className="app-stats-freshness">
                Last run {new Date(generatedAt).toISOString().replace("T", " ").slice(0, 16)} UTC
              </span>
            </>
          ) : null}
        </p>
      </header>
      <AppStatsView days={days} />
    </main>
  );
}
