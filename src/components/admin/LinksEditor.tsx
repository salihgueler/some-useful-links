"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ChevronDown,
  ChevronUp,
  ExternalLink,
  GripVertical,
  Pencil,
  Plus,
  Save,
  Trash2,
  X,
} from "lucide-react";
import type {
  LinkEntry,
  PageConfiguration,
} from "@/lib/config/links.types";
import { Modal } from "@/components/ui/Modal";
import { UnsavedGuard } from "@/components/admin/UnsavedGuard";

function orderedLinks(links: LinkEntry[]) {
  return links.map((link, index) => ({ ...link, order: index }));
}

/** Mirrors the server's slug rule so the field cannot offer an invalid address. */
function toSlug(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
}

export function LinksEditor({ initialPage }: { initialPage: PageConfiguration }) {
  const router = useRouter();
  const [page, setPage] = useState(() => structuredClone(initialPage));
  const [savedSnapshot, setSavedSnapshot] = useState(() => JSON.stringify(initialPage));
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [renaming, setRenaming] = useState(false);
  const [nextSlug, setNextSlug] = useState("");
  const [renameError, setRenameError] = useState("");
  const [renamingBusy, setRenamingBusy] = useState(false);

  /**
   * Renames through its own endpoint rather than the content save, because it
   * changes the page's identity and releases the old address.
   */
  const rename = async (event: React.FormEvent) => {
    event.preventDefault();
    setRenamingBusy(true);
    setRenameError("");
    const response = await fetch(`/app-api/pages/${page.slug}/rename`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ slug: nextSlug }),
    });
    const result = (await response.json().catch(() => ({}))) as {
      slug?: string;
      error?: string;
    };
    setRenamingBusy(false);
    if (!response.ok || !result.slug) {
      setRenameError(result.error ?? "The address could not be changed");
      return;
    }
    setRenaming(false);
    // The admin route is keyed by slug, so the old URL no longer resolves.
    router.replace(`/admin/${result.slug}/links`);
    router.refresh();
  };

  const updateLink = (index: number, patch: Partial<LinkEntry>) => {
    setPage((current) => ({
      ...current,
      links: current.links.map((link, linkIndex) =>
        linkIndex === index ? { ...link, ...patch } : link,
      ),
    }));
  };

  const moveLink = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= page.links.length) return;
    setPage((current) => {
      const links = [...current.links];
      [links[index], links[target]] = [links[target], links[index]];
      return { ...current, links: orderedLinks(links) };
    });
  };

  const addLink = () => {
    if (page.links.length >= 20) return;
    const id = `new-link-${Date.now()}`;
    setPage((current) => ({
      ...current,
      links: [
        ...current.links,
        {
          id,
          label: "New useful link",
          caption: "Add a short description",
          url: "https://example.com",
          icon: { emoji: "L", backgroundColor: "#DDD7FF" },
          enabled: true,
          order: current.links.length,
        },
      ],
    }));
  };

  const removeLink = (index: number) => {
    if (page.links.length === 1) return;
    setPage((current) => ({
      ...current,
      links: orderedLinks(current.links.filter((_, itemIndex) => itemIndex !== index)),
    }));
  };

  const dirty = useMemo(
    () => JSON.stringify(page) !== savedSnapshot,
    [page, savedSnapshot],
  );

  /** Returns whether the write succeeded, which the guard needs before leaving. */
  const persist = async () => {
    const body = { ...page, links: orderedLinks(page.links) };
    const response = await fetch(`/app-api/pages/${page.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setMessage(
      response.ok ? "Changes saved" : result.error ?? "The page could not be saved",
    );
    if (response.ok) setSavedSnapshot(JSON.stringify(body));
    return response.ok;
  };

  const save = () => {
    setMessage("");
    startTransition(() => {
      void persist();
    });
  };

  return (
    <div className="admin-editor">
      <UnsavedGuard dirty={dirty} onSave={persist} label="links" />
      <header className="editor-heading">
        <div>
          <p className="eyebrow">/{page.slug}</p>
          <h1>Your links</h1>
          <p>Manage the content and order of this public page.</p>
        </div>
        <div className="editor-actions">
          {message ? <span className="save-message">{message}</span> : null}
          <button
            type="button"
            className="primary-command"
            onClick={save}
            disabled={isPending}
          >
            <Save size={17} />
            {isPending ? "Saving..." : "Save changes"}
          </button>
        </div>
      </header>

      <section className="editor-section page-details">
        <div className="section-copy">
          <h2>Page details</h2>
          <p>The identity visitors see above your links.</p>
        </div>
        <div className="editor-fields two-column-fields">
          <label className="field">
            <span>Title</span>
            <input
              value={page.meta.title}
              maxLength={56}
              onChange={(event) =>
                setPage((current) => ({
                  ...current,
                  meta: { ...current.meta, title: event.target.value },
                }))
              }
            />
          </label>
          <label className="field">
            <span>Public URL</span>
            <div className="readonly-url">
              <span>{page.meta.url}</span>
              <button
                type="button"
                className="icon-command"
                aria-label="Change public address"
                title="Change public address"
                onClick={() => {
                  setNextSlug(page.slug);
                  setRenameError("");
                  setRenaming(true);
                }}
              >
                <Pencil size={15} />
              </button>
              <a
                href={page.slug === "home" ? "/" : `/${page.slug}`}
                rel="noreferrer"
                target="_blank"
                aria-label="Open public page"
              >
                <ExternalLink size={16} />
              </a>
            </div>
          </label>
          <label className="field field-wide">
            <span>Subtitle</span>
            <input
              value={page.meta.subtitle}
              maxLength={80}
              onChange={(event) =>
                setPage((current) => ({
                  ...current,
                  meta: { ...current.meta, subtitle: event.target.value },
                }))
              }
            />
            <small>{page.meta.subtitle.length}/80</small>
          </label>
        </div>
      </section>

      <Modal open={renaming} titleId="rename-page-title" onClose={() => setRenaming(false)}>
        <form className="create-page-form" onSubmit={rename}>
          <header>
            <div>
              <p className="eyebrow">Public address</p>
              <h2 id="rename-page-title">Change this collection&rsquo;s address</h2>
            </div>
            <button
              type="button"
              className="icon-command"
              aria-label="Close"
              onClick={() => setRenaming(false)}
            >
              <X size={19} />
            </button>
          </header>
          <p className="status-description">
            Analytics history moves with the collection. The old address{" "}
            <strong>/{page.slug}</strong> will stop working and return a 404, so any
            shared link or QR code pointing at it breaks, and the address becomes
            available for someone else to claim.
          </p>
          <label className="field">
            <span>New address</span>
            <div className="slug-input">
              <span>someusefullinks.com/</span>
              <input
                required
                pattern="[a-z0-9-]{2,48}"
                value={nextSlug}
                onChange={(event) => setNextSlug(toSlug(event.target.value))}
              />
            </div>
          </label>
          {renameError ? <p className="form-error">{renameError}</p> : null}
          <button
            className="primary-action form-submit"
            disabled={renamingBusy || nextSlug === page.slug}
          >
            {renamingBusy ? "Changing..." : "Change address"}
          </button>
        </form>
      </Modal>

      <section className="links-editor-section">
        <div className="links-editor-heading">
          <div>
            <h2>Links</h2>
            <p>{page.links.length} of 20 links</p>
          </div>
          <button
            type="button"
            className="secondary-command"
            onClick={addLink}
            disabled={page.links.length >= 20}
          >
            <Plus size={17} />
            Add link
          </button>
        </div>

        <div className="editable-links">
          {page.links.map((link, index) => (
            <article className="editable-link" key={link.id}>
              <div className="link-order-tools">
                <GripVertical size={18} aria-hidden="true" />
                <button
                  type="button"
                  title="Move up"
                  aria-label={`Move ${link.label} up`}
                  disabled={index === 0}
                  onClick={() => moveLink(index, -1)}
                >
                  <ChevronUp size={16} />
                </button>
                <button
                  type="button"
                  title="Move down"
                  aria-label={`Move ${link.label} down`}
                  disabled={index === page.links.length - 1}
                  onClick={() => moveLink(index, 1)}
                >
                  <ChevronDown size={16} />
                </button>
              </div>
              <div className="link-editor-icon">
                <input
                  aria-label={`Icon for ${link.label}`}
                  maxLength={2}
                  value={link.icon.emoji}
                  onChange={(event) =>
                    updateLink(index, {
                      icon: { ...link.icon, emoji: event.target.value },
                    })
                  }
                />
                <input
                  aria-label={`Icon color for ${link.label}`}
                  type="color"
                  value={link.icon.backgroundColor ?? "#DDD7FF"}
                  onChange={(event) =>
                    updateLink(index, {
                      icon: {
                        ...link.icon,
                        backgroundColor: event.target.value.toUpperCase(),
                      },
                    })
                  }
                />
              </div>
              <div className="link-editor-fields">
                <label className="field">
                  <span>Label</span>
                  <input
                    required
                    maxLength={40}
                    value={link.label}
                    onChange={(event) =>
                      updateLink(index, { label: event.target.value })
                    }
                  />
                </label>
                <label className="field">
                  <span>Caption</span>
                  <input
                    maxLength={60}
                    value={link.caption ?? ""}
                    onChange={(event) =>
                      updateLink(index, { caption: event.target.value })
                    }
                  />
                </label>
                <label className="field field-wide">
                  <span>Destination URL</span>
                  <input
                    required
                    type="url"
                    value={link.url}
                    onChange={(event) =>
                      updateLink(index, { url: event.target.value })
                    }
                  />
                </label>
              </div>
              <div className="link-row-actions">
                <label className="visibility-toggle">
                  <input
                    type="checkbox"
                    checked={link.enabled !== false}
                    onChange={(event) =>
                      updateLink(index, { enabled: event.target.checked })
                    }
                  />
                  <span>{link.enabled !== false ? "Live" : "Hidden"}</span>
                </label>
                <button
                  type="button"
                  className="danger-icon"
                  title="Delete link"
                  aria-label={`Delete ${link.label}`}
                  disabled={page.links.length === 1}
                  onClick={() => removeLink(index)}
                >
                  <Trash2 size={17} />
                </button>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
