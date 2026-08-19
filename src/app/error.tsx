"use client";

import Link from "next/link";
import { useEffect } from "react";
import { StatusScreen } from "@/components/layout/StatusScreen";

interface RouteErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function RouteError({ error, reset }: RouteErrorProps) {
  useEffect(() => {
    // Keep the detail in the browser console / server logs only. Rendering
    // error.message would leak internal paths to visitors.
    console.error("Route error", error);
  }, [error]);

  return (
    <StatusScreen
      code="500"
      title="Something went wrong on our side"
      description="The page could not be loaded. Trying again usually clears it."
      reference={error.digest}
    >
      <button className="status-action" onClick={reset} type="button">
        Try again
      </button>
      <Link className="status-action secondary" href="/">
        Go to the main page
      </Link>
    </StatusScreen>
  );
}
