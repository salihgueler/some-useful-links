import { NextResponse, type NextRequest } from "next/server";
import type { PageConfiguration } from "@/lib/config/links.types";
import { linkStore } from "@/lib/services";

const slugPattern = /^[a-z0-9-]{2,48}$/;

export async function GET() {
  return NextResponse.json(await linkStore.getPages());
}

export async function POST(request: NextRequest) {
  try {
    const input = (await request.json()) as { slug?: string; title?: string };
    const slug = input.slug?.trim().toLowerCase();
    const title = input.title?.trim();
    if (!slug || !slugPattern.test(slug) || !title) {
      return NextResponse.json(
        { error: "A title and URL-safe slug are required" },
        { status: 400 },
      );
    }

    const page: PageConfiguration = {
      slug,
      meta: {
        title,
        subtitle: "A fresh collection of useful links.",
        url: `https://someusefullinks.com/${slug}`,
        avatar: "/avatar.svg",
      },
      appearance: {
        primaryColor: "#5C4FB3",
        headerColor: "#EFEDFF",
        backgroundColor: "#F8F7FC",
        accentColor: "#FFB891",
        logoColor: "#BFECE6",
        buttonStyle: "raised",
      },
      links: [
        {
          id: "first-link",
          label: "My first useful link",
          caption: "Edit or replace this starter link",
          url: "https://example.com",
          icon: { emoji: "L", backgroundColor: "#DDD7FF" },
          enabled: true,
          order: 0,
        },
      ],
    };
    return NextResponse.json(await linkStore.createPage(page), { status: 201 });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Creation failed" },
      { status: 400 },
    );
  }
}
