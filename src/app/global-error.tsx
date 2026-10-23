"use client";

import { useEffect } from "react";
import { StatusScreen } from "@/components/layout/StatusScreen";
import "@/styles/globals.css";

interface GlobalErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/**
 * Replaces the root layout when it fails, so this file must render its own
 * <html> and <body>. The Manrope CSS variable is unavailable here; globals.css
 * falls back to the Manrope/system stack.
 */
export default function GlobalError({ error, reset }: GlobalErrorProps) {
  useEffect(() => {
    console.error("Global error", error);
  }, [error]);

  return (
    <html lang="en">
      <body>
        <StatusScreen
          code="500"
          title="The app failed to start"
          description="Something broke before the page could render. Reloading usually clears it."
          reference={error.digest}
        >
          <button className="status-action" onClick={reset} type="button">
            Reload the app
          </button>
        </StatusScreen>
      </body>
    </html>
  );
}
