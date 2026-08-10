import { NextResponse, type NextRequest } from "next/server";
import type { PageConfiguration } from "@/lib/config/links.types";
import { linkStore } from "@/lib/services";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
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
    const { slug } = await params;
    const page = (await request.json()) as PageConfiguration;
    return NextResponse.json(await linkStore.updatePage(slug, page));
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Update failed" },
      { status: 400 },
    );
  }
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    const { slug } = await params;
    const deleted = await linkStore.deletePage(slug);
    return NextResponse.json({ deleted }, { status: deleted ? 200 : 404 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Delete failed" },
      { status: 400 },
    );
  }
}
