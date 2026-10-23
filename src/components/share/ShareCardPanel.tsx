"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, Copy, Download, Save } from "lucide-react";
import type { PageConfiguration } from "@/lib/config/links.types";
import {
  CARD_SIZES,
  DEFAULT_SHARE_CAPTION,
  defaultShareNote,
  generateSocialCard,
} from "@/lib/canvas";

type Status = "loading" | "ready" | "error";

export function ShareCardPanel({
  page,
  className = "",
  editable = false,
}: {
  page: PageConfiguration;
  className?: string;
  /** The admin surface may edit the card's wording; public share views may not. */
  editable?: boolean;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [copied, setCopied] = useState(false);
  const [sizeId, setSizeId] = useState(CARD_SIZES[0].id);
  const [caption, setCaption] = useState(
    page.meta.shareCaption ?? DEFAULT_SHARE_CAPTION,
  );
  const [note, setNote] = useState(page.meta.shareNote ?? defaultShareNote(page));
  const [saveMessage, setSaveMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const size = CARD_SIZES.find((entry) => entry.id === sizeId) ?? CARD_SIZES[0];

  // The canvas renders from this rather than the prop, so edits preview live
  // without needing a save first.
  const previewPage = useMemo<PageConfiguration>(
    () => ({
      ...page,
      meta: { ...page.meta, shareCaption: caption, shareNote: note },
    }),
    [page, caption, note],
  );

  useEffect(() => {
    if (!canvasRef.current) return;
    setStatus("loading");
    generateSocialCard(canvasRef.current, previewPage, size)
      .then(() => setStatus("ready"))
      .catch(() => setStatus("error"));
  }, [previewPage, size]);

  const download = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `${page.slug}-share-card-${size.width}x${size.height}.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const saveText = async () => {
    setSaving(true);
    setSaveMessage("");
    const response = await fetch(`/app-api/pages/${page.slug}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...page,
        meta: { ...page.meta, shareCaption: caption, shareNote: note },
      }),
    });
    const result = (await response.json().catch(() => ({}))) as { error?: string };
    setSaving(false);
    setSaveMessage(
      response.ok ? "Card text saved" : result.error ?? "Card text could not be saved",
    );
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(page.meta.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
    void fetch("/app-api/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "share", pageSlug: page.slug }),
    });
  };

  return (
    <div className={`share-card-panel ${className}`}>
      <div className="canvas-frame" aria-live="polite">
        {status === "loading" ? (
          <div className="canvas-loading">
            <span className="spinner" />
            <span>Making your card...</span>
          </div>
        ) : null}
        {status === "error" ? (
          <div className="canvas-loading error">
            The share card could not be generated.
          </div>
        ) : null}
        <canvas
          ref={canvasRef}
          aria-label={`Share card preview for ${page.meta.title}`}
          className={status === "ready" ? "ready" : ""}
        />
      </div>
      <div className="share-controls">
        {editable ? (
          <div className="share-text-fields">
            <label className="field">
              <span>Card label</span>
              <input
                value={caption}
                maxLength={24}
                placeholder={DEFAULT_SHARE_CAPTION}
                onChange={(event) => setCaption(event.target.value)}
              />
            </label>
            <label className="field">
              <span>Card note</span>
              <input
                value={note}
                maxLength={44}
                placeholder={defaultShareNote(page)}
                onChange={(event) => setNote(event.target.value)}
              />
            </label>
            <button
              type="button"
              className="secondary-command"
              onClick={saveText}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save card text"}
            </button>
            {saveMessage ? (
              <span className="save-message">{saveMessage}</span>
            ) : null}
            <span className="field-hint">
              Either field can be left empty to leave that line off the card.
            </span>
          </div>
        ) : null}
        <label>
          <span>Format</span>
          <select
            value={sizeId}
            onChange={(event) => setSizeId(event.target.value)}
            aria-label="Download size"
          >
            {CARD_SIZES.map((entry) => (
              <option key={entry.id} value={entry.id}>
                PNG · {entry.label.replace(/^[^·]+· /, "")}
              </option>
            ))}
          </select>
        </label>
        <div className="share-actions">
          <button type="button" className="secondary-action" onClick={copyLink}>
            {copied ? <Check size={18} /> : <Copy size={18} />}
            {copied ? "Link copied" : "Copy link"}
          </button>
          <button
            type="button"
            className="primary-action"
            onClick={download}
            disabled={status !== "ready"}
          >
            <Download size={18} />
            Download PNG
          </button>
        </div>
      </div>
    </div>
  );
}
