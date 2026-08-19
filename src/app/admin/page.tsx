import { redirect } from "next/navigation";
import { requireOwnerPage } from "@/lib/auth/require-owner";

export default async function AdminPage() {
  await requireOwnerPage();
  redirect("/admin/home/links");
}
