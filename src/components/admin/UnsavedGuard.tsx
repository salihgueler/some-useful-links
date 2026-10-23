"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Modal } from "@/components/ui/Modal";
import { setNavigationGuard } from "@/lib/unsaved";

/**
 * Blocks navigation away from an editor with unsaved changes.
 *
 * Covers three ways of leaving: the section tabs and other in-app anchors, the
 * collection switcher's imperative router.push (via the navigation registry),
 * and closing or reloading the tab (via beforeunload, which is the only one the
 * browser handles for us and the only one we cannot style).
 */
export function UnsavedGuard({
  dirty,
  onSave,
  label,
}: {
  dirty: boolean;
  onSave: () => Promise<boolean>;
  /** What the user is about to lose, named in the prompt. */
  label: string;
}) {
  const router = useRouter();
  const [destination, setDestination] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const intercept = useCallback(
    (next: string) => {
      if (!dirty) return false;
      setError("");
      setDestination(next);
      return true;
    },
    [dirty],
  );

  useEffect(() => setNavigationGuard(intercept), [intercept]);

  useEffect(() => {
    if (!dirty) return;
    const warn = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      // Browsers show their own wording; assigning returnValue is what arms it.
      event.returnValue = "";
    };
    window.addEventListener("beforeunload", warn);
    return () => window.removeEventListener("beforeunload", warn);
  }, [dirty]);

  useEffect(() => {
    if (!dirty) return;
    const onClick = (event: MouseEvent) => {
      // Leave modified clicks alone: they open a new tab, so nothing is lost.
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }
      const target = event.target as HTMLElement | null;
      const anchor = target?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank") return;

      const url = new URL(anchor.href, window.location.href);
      // Off-site navigation is beforeunload's job, and same-page links are not
      // navigation at all.
      if (url.origin !== window.location.origin) return;
      if (url.pathname === window.location.pathname) return;

      event.preventDefault();
      event.stopPropagation();
      setError("");
      setDestination(`${url.pathname}${url.search}`);
    };
    // Capture phase, so this runs before the router's own click handling.
    document.addEventListener("click", onClick, true);
    return () => document.removeEventListener("click", onClick, true);
  }, [dirty]);

  const leave = (to: string) => {
    setDestination(null);
    router.push(to);
  };

  return (
    <Modal
      open={destination !== null}
      titleId="unsaved-title"
      onClose={() => setDestination(null)}
    >
      <div className="create-page-form">
        <header>
          <div>
            <p className="eyebrow">Unsaved changes</p>
            <h2 id="unsaved-title">Save your {label} first?</h2>
          </div>
        </header>
        <p className="status-description">
          You have changes on this page that have not been saved. Leaving now
          discards them.
        </p>
        {error ? <p className="form-error">{error}</p> : null}
        <div className="unsaved-actions">
          <button
            type="button"
            className="primary-action"
            disabled={busy}
            onClick={async () => {
              const to = destination;
              if (!to) return;
              setBusy(true);
              const saved = await onSave();
              setBusy(false);
              if (saved) {
                leave(to);
              } else {
                setError("Those changes could not be saved, so you are still here.");
              }
            }}
          >
            {busy ? "Saving..." : "Save and leave"}
          </button>
          <button
            type="button"
            className="secondary-action"
            disabled={busy}
            onClick={() => destination && leave(destination)}
          >
            Discard and leave
          </button>
          <button
            type="button"
            className="auth-switch"
            disabled={busy}
            onClick={() => setDestination(null)}
          >
            Stay on this page
          </button>
        </div>
      </div>
    </Modal>
  );
}
