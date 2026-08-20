import { NextResponse, type NextRequest } from "next/server";
import { errorResponse } from "@/lib/api/errors";
import { assertJsonBody, assertSameOrigin } from "@/lib/api/csrf";
import { requireOwnerApi } from "@/lib/auth/require-owner";
import { validatePageInput } from "@/lib/config/links.validate";
import { linkStore } from "@/lib/services";

const slugPattern = /^[a-z0-9-]{2,48}$/;

/**
 * Moves a collection to a new public address.
 *
 * Deliberately NOT part of PATCH: renaming is a distinct operation with a
 * different consequence (the old address stops resolving) and it changes the
 * resource's own identity, so it should not ride along with a content save.
 *
 * The old slug is released rather than redirected, so any link or QR code
 * pointing at it will 404 afterwards.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  try {
    assertSameOrigin(request);
    assertJsonBody(request);
    await requireOwnerApi();

    const { slug } = await params;
    const input = (await request.json()) as { slug?: string };
    const nextSlug = input.slug?.trim().toLowerCase();

    if (!nextSlug || !slugPattern.test(nextSlug)) {
      return NextResponse.json(
        { error: "A URL-safe address of 2-48 characters is required" },
        { status: 400 },
      );
    }
    if (nextSlug === slug) {
      return NextResponse.json(
        { error: "That is already this collection's address" },
        { status: 400 },
      );
    }

    const current = await linkStore.getPage(slug);
    if (!current) {
      return NextResponse.json({ error: "Page not found" }, { status: 404 });
    }

    // Rebuild the public URL from the one already stored rather than from a
    // hardcoded host, so a rename cannot silently move the page to a different
    // domain than the rest of the collection uses.
    const url = new URL(current.meta.url);
    url.pathname = `/${nextSlug}`;

    const renamed = validatePageInput({
      ...current,
      slug: nextSlug,
      meta: { ...current.meta, url: url.toString() },
    });

    return NextResponse.json(await linkStore.renamePage(slug, nextSlug, renamed));
  } catch (error) {
    return errorResponse(error, "Rename failed");
  }
}
