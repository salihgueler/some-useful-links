"use client";

import { useState, useTransition, type CSSProperties } from "react";
import { Save } from "lucide-react";
import type {
  ButtonStyle,
  PageAppearance,
  PageConfiguration,
} from "@/lib/config/links.types";
import { LogoMark } from "@/components/layout/LogoMark";

type PreviewStyle = CSSProperties & Record<`--preview-${string}`, string>;

const colorFields: Array<{
  key: keyof Omit<PageAppearance, "buttonStyle">;
  label: string;
}> = [
  { key: "primaryColor", label: "Primary" },
  { key: "headerColor", label: "Header" },
  { key: "backgroundColor", label: "Background" },
  { key: "accentColor", label: "Accent" },
  { key: "logoColor", label: "Logo" },
];

export function AppearanceEditor({
  initialPage,
}: {
  initialPage: PageConfiguration;
}) {
  const [page, setPage] = useState(() => structuredClone(initialPage));
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  const setAppearance = <K extends keyof PageAppearance>(
    key: K,
    value: PageAppearance[K],
  ) => {
    setPage((current) => ({
      ...current,
      appearance: { ...current.appearance, [key]: value },
    }));
  };

  const save = () => {
    setMessage("");
    startTransition(async () => {
      const response = await fetch(`/app-api/pages/${page.slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(page),
      });
      const result = (await response.json()) as { error?: string };
      setMessage(
        response.ok
          ? "Appearance saved"
          : result.error ?? "Appearance could not be saved",
      );
    });
  };

  const previewStyle: PreviewStyle = {
    "--preview-primary": page.appearance.primaryColor,
    "--preview-header": page.appearance.headerColor,
    "--preview-background": page.appearance.backgroundColor,
    "--preview-accent": page.appearance.accentColor,
    "--preview-logo": page.appearance.logoColor,
  };

  return (
    <div className="admin-editor appearance-editor">
      <header className="editor-heading">
        <div>
          <p className="eyebrow">/{page.slug}</p>
          <h1>Appearance</h1>
          <p>Shape this page without changing its content.</p>
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
            {isPending ? "Saving..." : "Save appearance"}
          </button>
        </div>
      </header>

      <div className="appearance-grid">
        <section className="editor-section appearance-controls">
          <div className="section-copy">
            <h2>Color palette</h2>
            <p>Choose accessible surfaces and accents for this page.</p>
          </div>
          <div className="color-controls">
            {colorFields.map((field) => (
              <label className="color-control" key={field.key}>
                <input
                  type="color"
                  value={page.appearance[field.key]}
                  onChange={(event) =>
                    setAppearance(field.key, event.target.value.toUpperCase())
                  }
                />
                <span>
                  <strong>{field.label}</strong>
                  <small>{page.appearance[field.key]}</small>
                </span>
              </label>
            ))}
          </div>
          <fieldset className="button-style-control">
            <legend>Button style</legend>
            <div>
              {(["raised", "flat", "outline"] as ButtonStyle[]).map((style) => (
                <label key={style}>
                  <input
                    type="radio"
                    name="button-style"
                    value={style}
                    checked={page.appearance.buttonStyle === style}
                    onChange={() => setAppearance("buttonStyle", style)}
                  />
                  <span>{style}</span>
                </label>
              ))}
            </div>
          </fieldset>
        </section>

        <section className="appearance-preview-panel">
          <header>
            <h2>Live preview</h2>
            <span>Updates instantly</span>
          </header>
          <div
            className="appearance-phone"
            data-button-style={page.appearance.buttonStyle}
            style={previewStyle}
          >
            <div className="appearance-phone-header">
              <LogoMark />
              <strong>{page.meta.title}</strong>
              <p>{page.meta.subtitle}</p>
            </div>
            <div className="appearance-phone-links">
              {page.links.slice(0, 4).map((link) => (
                <span key={link.id}>
                  <i style={{ background: link.icon.backgroundColor }}>
                    {link.icon.emoji}
                  </i>
                  {link.label}
                </span>
              ))}
            </div>
            <span className="appearance-accent">Curated with care</span>
          </div>
        </section>
      </div>
    </div>
  );
}
