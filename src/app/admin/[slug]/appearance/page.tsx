import { notFound } from "next/navigation";
import { AppearanceEditor } from "@/components/admin/AppearanceEditor";
import { linkStore } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function AppearancePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await linkStore.getPage(slug);
  if (!page) notFound();
  return <AppearanceEditor initialPage={page} />;
}
