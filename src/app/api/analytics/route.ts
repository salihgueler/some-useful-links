import { NextResponse, type NextRequest } from "next/server";
import { analyticsStore } from "@/lib/services";

function subtractDays(date: string, days: number) {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() - days + 1);
  return value.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  try {
    const params = request.nextUrl.searchParams;
    const pageSlug = params.get("pageSlug") ?? "home";
    const range = params.get("range");
    let startDate = params.get("startDate") ?? undefined;
    let endDate = params.get("endDate") ?? undefined;

    if (range && range !== "all") {
      const fullReport = await analyticsStore.query({ pageSlug });
      endDate = fullReport.range.endDate;
      startDate = subtractDays(endDate, Number.parseInt(range, 10));
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
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Analytics failed" },
      { status: 400 },
    );
  }
}
