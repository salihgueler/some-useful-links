"use client";

import { useEffect } from "react";

export function VisitorTracker({ pageSlug }: { pageSlug: string }) {
  useEffect(() => {
    void fetch("/app-api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "page-view",
        pageSlug,
        referrer: document.referrer,
      }),
      keepalive: true,
    });
  }, [pageSlug]);

  return null;
}
