import { NextResponse, type NextRequest } from "next/server";
import type { TrackVisitInput } from "@/lib/services";
import { linkStore, visitTracker } from "@/lib/services";

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as TrackVisitInput;
    if (!["page-view", "link-click", "share"].includes(input.type)) {
      return NextResponse.json({ error: "Invalid event type" }, { status: 400 });
    }
    if (!input.pageSlug || !(await linkStore.getPage(input.pageSlug))) {
      return NextResponse.json({ error: "Unknown page slug" }, { status: 400 });
    }
    if (
      input.linkId &&
      !(await linkStore.getLinkById(input.pageSlug, input.linkId))
    ) {
      return NextResponse.json({ error: "Unknown link ID" }, { status: 400 });
    }

    const event = await visitTracker.track({
      ...input,
      referrer: input.referrer || request.headers.get("referer") || undefined,
      userAgent: request.headers.get("user-agent") || undefined,
    });
    return NextResponse.json({ ok: true, eventId: event.id }, { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Tracking failed" },
      { status: 400 },
    );
  }
}
