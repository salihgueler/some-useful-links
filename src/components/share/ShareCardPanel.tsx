"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Download } from "lucide-react";
import type { PageConfiguration } from "@/lib/config/links.types";
import { generateSocialCard } from "@/lib/canvas";

type Status = "loading" | "ready" | "error";

export function ShareCardPanel({
  page,
  className = "",
}: {
  page: PageConfiguration;
  className?: string;
}) {
  const [status, setStatus] = useState<Status>("loading");
  const [copied, setCopied] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!canvasRef.current) return;
    setStatus("loading");
    generateSocialCard(canvasRef.current, page)
      .then(() => setStatus("ready"))
      .catch(() => setStatus("error"));
  }, [page]);

  const download = () => {
    if (!canvasRef.current) return;
    const link = document.createElement("a");
    link.download = `${page.slug}-share-card.png`;
    link.href = canvasRef.current.toDataURL("image/png");
    link.click();
  };

  const copyLink = async () => {
    await navigator.clipboard.writeText(page.meta.url);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
    void fetch("/api/track", {
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
        <label>
          <span>Format</span>
          <select defaultValue="png" aria-label="Download format">
            <option value="png">PNG · 1200 × 630</option>
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
