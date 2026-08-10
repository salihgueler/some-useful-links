import { notFound } from "next/navigation";
import { LinksEditor } from "@/components/admin/LinksEditor";
import { linkStore } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function LinksPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await linkStore.getPage(slug);
  if (!page) notFound();
  return <LinksEditor initialPage={page} />;
}
