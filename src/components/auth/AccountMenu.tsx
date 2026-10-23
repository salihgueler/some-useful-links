"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { rpc } from "@/lib/auth/rpc";

/**
 * "ada.lovelace@amazon.de" -> "AL"; "gate@amazon.com" -> "GA".
 *
 * Only alphabetic name parts are considered, so an address whose local part
 * carries a numeric segment ("ui.1787135655") yields "UI" rather than "U1".
 */
function initials(email: string): string {
  const local = email.split("@")[0] ?? email;
  const words = local.split(/[._-]+/).filter((part) => /^[a-z]/i.test(part));
  const letters =
    words.length > 1
      ? `${words[0][0]}${words[1][0]}`
      : (words[0] ?? local).slice(0, 2);
  return letters.toUpperCase();
}

/**
 * Renders a fragment rather than a wrapper element so both children stay direct
 * children of .admin-actions, which the existing header styles depend on.
 */
export function AccountMenu({ email }: { email: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const signOut = async () => {
    setBusy(true);
    setError(null);
    try {
      await rpc("signOut", []);
      router.replace("/login");
      router.refresh();
    } catch (cause) {
      setBusy(false);
      setError(cause instanceof Error ? cause.message : "Sign out failed");
    }
  };

  return (
    <>
      <button
        className="admin-signout"
        disabled={busy}
        onClick={signOut}
        type="button"
      >
        {busy ? "Signing out..." : "Sign out"}
      </button>
      <span aria-label={`Signed in as ${email}`} title={email}>
        {initials(email)}
      </span>
      {error ? (
        <span className="sr-only" role="alert">
          {error}
        </span>
      ) : null}
    </>
  );
}
