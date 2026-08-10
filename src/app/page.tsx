import { PublicLinkPage } from "@/components/links/PublicLinkPage";
import { linkStore } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const page = await linkStore.getEnabledLinks();
  return <PublicLinkPage page={page} />;
}
