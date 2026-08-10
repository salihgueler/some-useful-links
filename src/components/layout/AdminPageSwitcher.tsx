"use client";

import { useState } from "react";
import { Plus, X } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { PageSummary } from "@/lib/config/links.types";
import { Modal } from "@/components/ui/Modal";

function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function AdminPageSwitcher({
  pages,
  activeSlug,
}: {
  pages: PageSummary[];
  activeSlug: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState("");
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const section = pathname.split("/").at(-1) || "links";

  const changePage = (nextSlug: string) => {
    router.push(`/admin/${nextSlug}/${section}`);
  };

  const createPage = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    const response = await fetch("/api/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, slug }),
    });
    const result = (await response.json()) as { slug?: string; error?: string };
    setSaving(false);
    if (!response.ok || !result.slug) {
      setError(result.error ?? "Page creation failed");
      return;
    }
    setOpen(false);
    router.push(`/admin/${result.slug}/links`);
    router.refresh();
  };

  return (
    <div className="page-switcher">
      <label>
        <span className="sr-only">Active page</span>
        <select
          value={activeSlug}
          onChange={(event) => changePage(event.target.value)}
        >
          {pages.map((page) => (
            <option key={page.slug} value={page.slug}>
              {page.title}
            </option>
          ))}
        </select>
      </label>
      <button
        type="button"
        className="icon-command"
        aria-label="Create page"
        title="Create page"
        onClick={() => setOpen(true)}
      >
        <Plus size={18} />
      </button>

      <Modal open={open} titleId="new-page-title" onClose={() => setOpen(false)}>
        <form className="create-page-form" onSubmit={createPage}>
          <header>
            <div>
              <p className="eyebrow">New collection</p>
              <h2 id="new-page-title">Create a link page</h2>
            </div>
            <button
              type="button"
              className="icon-command"
              aria-label="Close"
              onClick={() => setOpen(false)}
            >
              <X size={19} />
            </button>
          </header>
          <label className="field">
            <span>Page title</span>
            <input
              required
              maxLength={56}
              value={title}
              onChange={(event) => {
                setTitle(event.target.value);
                if (!slugEdited) setSlug(toSlug(event.target.value));
              }}
              placeholder="Conference field guide"
            />
          </label>
          <label className="field">
            <span>Public URL</span>
            <div className="slug-input">
              <span>someusefullinks.com/</span>
              <input
                required
                pattern="[a-z0-9-]{2,48}"
                value={slug}
                onChange={(event) => {
                  setSlugEdited(true);
                  setSlug(toSlug(event.target.value));
                }}
              />
            </div>
          </label>
          {error ? <p className="form-error">{error}</p> : null}
          <button className="primary-action form-submit" disabled={saving}>
            {saving ? "Creating..." : "Create page"}
          </button>
        </form>
      </Modal>
    </div>
  );
}
