"use client";

import Link from "next/link";
import { useEffect } from "react";

interface AdminErrorProps {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function AdminError({ error, reset }: AdminErrorProps) {
  useEffect(() => {
    console.error("Admin view error", error);
  }, [error]);

  return (
    <section className="panel status-inline">
      <p className="eyebrow">Something went wrong</p>
      <h1>This view could not load</h1>
      <p>
        Your saved links are unaffected. Retry the view, or head back to the
        admin home.
      </p>
      <div className="status-actions">
        <button className="status-action" onClick={reset} type="button">
          Try again
        </button>
        <Link className="status-action secondary" href="/admin">
          Back to admin home
        </Link>
      </div>
      {error.digest ? (
        <p className="status-reference">
          Support reference <code>{error.digest}</code>
        </p>
      ) : null}
    </section>
  );
}
