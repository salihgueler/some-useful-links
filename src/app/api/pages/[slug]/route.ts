import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { assertJsonBody, assertSameOrigin } from "@/lib/api/csrf";
import { requireOwnerApi } from "@/lib/auth/require-owner";
import { validatePageInput } from "@/lib/config/links.validate";
import { linkStore } from "@/lib/services";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    await requireOwnerApi();
  } catch (error) {
    return errorResponse(error, "Not authorized");
  }
  const { slug } = await params;
  const page = await linkStore.getPage(slug);
  if (!page) {
    return NextResponse.json({ error: "Page not found" }, { status: 404 });
  }
  return NextResponse.json(page);
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    assertSameOrigin(request);
    assertJsonBody(request);
    await requireOwnerApi();
    const { slug } = await params;
    const page = validatePageInput(await request.json());
    return NextResponse.json(await linkStore.updatePage(slug, page));
  } catch (error) {
    return errorResponse(error, "Update failed");
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    assertSameOrigin(request);
    await requireOwnerApi();
    const { slug } = await params;
    const deleted = await linkStore.deletePage(slug);
    return NextResponse.json({ deleted }, { status: deleted ? 200 : 404 });
  } catch (error) {
    return errorResponse(error, "Delete failed");
  }
}
