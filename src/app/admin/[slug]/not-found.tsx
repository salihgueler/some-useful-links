import type { Metadata } from "next";
import Link from "next/link";
import { StatusScreen } from "@/components/layout/StatusScreen";

export const metadata: Metadata = {
  title: "Collection not found",
  robots: { index: false, follow: false },
};

export default function AdminPageNotFound() {
  return (
    <StatusScreen
      code="404"
      title="No such collection"
      description="This collection does not exist, or it is not one of yours."
    >
      <Link className="status-action" href="/admin">
        Back to admin home
      </Link>
    </StatusScreen>
  );
}
