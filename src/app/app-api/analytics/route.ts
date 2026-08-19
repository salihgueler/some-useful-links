import { NextResponse, type NextRequest } from "next/server";
import { PublicError, errorResponse } from "@/lib/api/errors";
import { requireOwnerApi } from "@/lib/auth/require-owner";
import { analyticsStore } from "@/lib/services";

function subtractDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days + 1);
  return value.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    await requireOwnerApi();
    const params = request.nextUrl.searchParams;
    const pageSlug = params.get("pageSlug") ?? "home";
    const range = params.get("range");
    let startDate = params.get("startDate") ?? undefined;
    let endDate = params.get("endDate") ?? undefined;

    if (range && range !== "all") {
      // Number.parseInt("abc") is NaN, which propagated into subtractDays and
      // produced an Invalid Date and a silently empty report.
      const days = Number(range);
      if (!Number.isInteger(days) || days < 1 || days > 3650) {
        throw new PublicError("range must be a whole number of days, or \"all\"");
      }
      const fullReport = await analyticsStore.query({ pageSlug });
      // An owner with no aggregate rows yet has an empty range. Feeding "" to
      // subtractDays built an Invalid Date whose toISOString() threw, so
      // choosing a range in the dashboard returned 500 for most owners.
      endDate = fullReport.range.endDate || new Date().toISOString().slice(0, 10);
      startDate = subtractDays(endDate, days);
    }

    const report = await analyticsStore.query({
      pageSlug,
      startDate,
      endDate,
      linkId: params.get("linkId") ?? undefined,
      aggregation:
        (params.get("aggregation") as "day" | "week" | "month" | null) ??
        "day",
    });
    return NextResponse.json(report);
  } catch (error) {
    return errorResponse(error, "Analytics failed");
  }
}
