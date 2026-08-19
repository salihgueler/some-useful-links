import type { Metadata } from "next";
import Link from "next/link";
import { StatusScreen } from "@/components/layout/StatusScreen";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false, follow: false },
};

export default function NotFound() {
  return (
    <StatusScreen
      code="404"
      title="This page isn’t here"
      description="The address may be mistyped, or the collection it pointed to was renamed or removed."
    >
      <Link className="status-action" href="/">
        Go to the main page
      </Link>
    </StatusScreen>
  );
}
