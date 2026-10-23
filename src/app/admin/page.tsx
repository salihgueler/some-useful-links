import { redirect } from "next/navigation";
import { requireOwnerPage } from "@/lib/auth/require-owner";
import { linkStore } from "@/lib/services";

export default async function AdminPage() {
  await requireOwnerPage();
  // Each owner has their own collections, so "home" is not a valid assumption.
  const pages = await linkStore.getPages();
  if (pages.length === 0) redirect("/admin/start");
  redirect(`/admin/${pages[0].slug}/links`);
}
