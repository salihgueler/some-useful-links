"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

/**
 * Posts to the existing /api/pages route rather than calling Blocks directly,
 * so the default page shape and its schema validation stay in one place.
 */
export function CreateFirstCollection() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/pages", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug, title }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Could not create it");
      router.replace(`/admin/${slug}/links`);
      router.refresh();
    } catch (cause) {
      setBusy(false);
      setError(cause instanceof Error ? cause.message : "Something went wrong");
    }
  };

  return (
    <form className="auth-form" onSubmit={submit}>
      <label className="field">
        <span>Collection name</span>
        <input
          disabled={busy}
          maxLength={56}
          onChange={(e) => setTitle(e.target.value)}
          required
          value={title}
        />
      </label>
      <label className="field">
        <span>Public address</span>
        <input
          disabled={busy}
          onChange={(e) =>
            setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))
          }
          pattern="[a-z0-9\-]{2,48}"
          placeholder="team-reading"
          required
          value={slug}
        />
        <small>{slug ? `/${slug}` : "letters, numbers and hyphens"}</small>
      </label>
      {error ? (
        <p className="form-error" role="alert">
          {error}
        </p>
      ) : null}
      <button className="status-action" disabled={busy} type="submit">
        {busy ? "Creating..." : "Create collection"}
      </button>
    </form>
  );
}
