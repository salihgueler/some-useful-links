"use client";

import { useRef, useState, useTransition, type CSSProperties } from "react";
import { ImageDown, Save, Trash2, Upload } from "lucide-react";
import type {
  ButtonStyle,
  PageAppearance,
  PageConfiguration,
} from "@/lib/config/links.types";
import { LogoMark } from "@/components/layout/LogoMark";
import { DEFAULT_BADGE } from "@/components/links/PublicLinkPage";
import { borderOn, readableInk, softInk, surfaceOn } from "@/lib/color";
import { extractPalette, paletteToColors, readLogoDataUrl } from "@/lib/palette";
import { THEME_PRESETS, activePresetId } from "@/lib/config/themes";

type PreviewStyle = CSSProperties & Record<`--preview-${string}`, string>;

/** Fallbacks match the public page, so an unset optional colour previews true. */
const DEFAULT_BADGE_COLOR = "#FFD9C3";

const colorFields: Array<{
  key: keyof Omit<PageAppearance, "buttonStyle">;
  label: string;
  fallback: string;
}> = [
  { key: "primaryColor", label: "Primary", fallback: "#5C4FB3" },
  { key: "headerColor", label: "Header", fallback: "#EFEDFF" },
  { key: "backgroundColor", label: "Background", fallback: "#F8F7FC" },
  { key: "accentColor", label: "Accent", fallback: "#FFB891" },
  { key: "logoColor", label: "Logo", fallback: "#BFECE6" },
  { key: "badgeColor", label: "Badge", fallback: DEFAULT_BADGE_COLOR },
];

export function AppearanceEditor({
  initialPage,
}: {
  initialPage: PageConfiguration;
}) {
  const [page, setPage] = useState(() => structuredClone(initialPage));
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();
  const [palette, setPalette] = useState<string[] | null>(null);
  const [imageError, setImageError] = useState("");
  const [busyImage, setBusyImage] = useState(false);
  const paletteInput = useRef<HTMLInputElement>(null);
  const logoInput = useRef<HTMLInputElement>(null);

  const { appearance, meta } = page;
  const activePreset = activePresetId(appearance);

  const setAppearance = <K extends keyof PageAppearance>(
    key: K,
    value: PageAppearance[K],
  ) => {
    setPage((current) => ({
      ...current,
      appearance: { ...current.appearance, [key]: value },
    }));
  };

  const applyColors = (colors: Partial<PageAppearance>) => {
    setPage((current) => ({
      ...current,
      appearance: { ...current.appearance, ...colors },
    }));
    setMessage("");
  };

  /** Reads the chosen image and shows its palette before anything is applied. */
  const readPalette = async (file: File) => {
    setImageError("");
    setBusyImage(true);
    try {
      setPalette(await extractPalette(file, 6));
    } catch (cause) {
      setPalette(null);
      setImageError(cause instanceof Error ? cause.message : "That image could not be read");
    } finally {
      setBusyImage(false);
    }
  };

  const readLogo = async (file: File) => {
    setImageError("");
    setBusyImage(true);
    try {
      const logo = await readLogoDataUrl(file);
      setPage((current) => ({
        ...current,
        meta: { ...current.meta, logo },
      }));
    } catch (cause) {
      setImageError(cause instanceof Error ? cause.message : "That logo could not be read");
    } finally {
      setBusyImage(false);
    }
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

  // Mirrors the public page's derivation so a dark preset previews as dark
  // rather than showing light-mode ink the visitor will never see.
  const headerInk = readableInk(appearance.headerColor);
  const bodyInk = appearance.inkColor ?? readableInk(appearance.backgroundColor);
  const badgeColor = appearance.badgeColor ?? DEFAULT_BADGE_COLOR;

  const previewStyle: PreviewStyle = {
    "--preview-primary": appearance.primaryColor,
    "--preview-header": appearance.headerColor,
    "--preview-background": appearance.backgroundColor,
    "--preview-accent": appearance.accentColor,
    "--preview-logo": appearance.logoColor,
    "--preview-ink": bodyInk,
    "--preview-ink-soft": softInk(appearance.backgroundColor, bodyInk),
    "--preview-header-ink": headerInk,
    "--preview-header-ink-soft": softInk(appearance.headerColor, headerInk),
    "--preview-border": borderOn(appearance.backgroundColor),
    "--preview-surface": surfaceOn(appearance.backgroundColor),
    "--preview-badge": badgeColor,
    "--preview-badge-ink": readableInk(badgeColor),
  };

  const badgeText = meta.badge ?? DEFAULT_BADGE;

  return (
    <div className="admin-editor appearance-editor">
      <header className="editor-heading">
        <div>
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
            <h2>Theme</h2>
            <p>Start from a preset, then adjust any single colour below.</p>
          </div>
          <div className="theme-presets">
            {THEME_PRESETS.map((preset) => (
              <button
                type="button"
                key={preset.id}
                className="theme-preset"
                aria-pressed={activePreset === preset.id}
                onClick={() => applyColors(preset.colors)}
              >
                <span className="theme-swatches" aria-hidden="true">
                  {/* Keyed by role, not by colour: a preset can legitimately use
                      the same hex twice (Kiro's primary and badge are both
                      #7138CC), which makes the value a colliding key. */}
                  {Object.entries(preset.colors).map(([role, color]) => (
                    <i key={role} style={{ background: color }} />
                  ))}
                </span>
                <strong>{preset.name}</strong>
                <small>{preset.description}</small>
              </button>
            ))}
          </div>

          <div className="section-copy">
            <h2>From an image</h2>
            <p>
              Pull a palette out of a picture. The colours are measured from the
              image itself, not guessed.
            </p>
          </div>
          <div className="image-tools">
            <button
              type="button"
              className="secondary-command"
              disabled={busyImage}
              onClick={() => paletteInput.current?.click()}
            >
              <ImageDown size={16} />
              Choose an image
            </button>
            <input
              ref={paletteInput}
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readPalette(file);
                event.target.value = "";
              }}
            />
            {palette ? (
              <div className="palette-result">
                <span className="theme-swatches" aria-hidden="true">
                  {/* Index-keyed: median cut can return the same average twice
                      for an image with a narrow palette. */}
                  {palette.map((color, index) => (
                    <i key={`${color}-${index}`} style={{ background: color }} />
                  ))}
                </span>
                <button
                  type="button"
                  className="secondary-command"
                  onClick={() => applyColors(paletteToColors(palette))}
                >
                  Use these colours
                </button>
              </div>
            ) : null}
          </div>

          <div className="section-copy">
            <h2>Conference logo</h2>
            <p>Optional. Replaces the smiley mark at the top of the page.</p>
          </div>
          <div className="image-tools">
            <button
              type="button"
              className="secondary-command"
              disabled={busyImage}
              onClick={() => logoInput.current?.click()}
            >
              <Upload size={16} />
              {meta.logo ? "Replace logo" : "Upload a logo"}
            </button>
            <input
              ref={logoInput}
              className="sr-only"
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void readLogo(file);
                event.target.value = "";
              }}
            />
            {meta.logo ? (
              <button
                type="button"
                className="danger-icon"
                aria-label="Remove the logo"
                title="Remove the logo"
                onClick={() =>
                  setPage((current) => ({
                    ...current,
                    meta: { ...current.meta, logo: undefined },
                  }))
                }
              >
                <Trash2 size={16} />
              </button>
            ) : null}
          </div>
          {imageError ? <p className="form-error">{imageError}</p> : null}

          <div className="section-copy">
            <h2>Colour palette</h2>
            <p>Text colours are worked out from these surfaces automatically.</p>
          </div>
          <div className="color-controls">
            {colorFields.map((field) => (
              <label className="color-control" key={field.key}>
                <input
                  type="color"
                  value={appearance[field.key] ?? field.fallback}
                  onChange={(event) =>
                    setAppearance(field.key, event.target.value.toUpperCase())
                  }
                />
                <span>
                  <strong>{field.label}</strong>
                  <small>{appearance[field.key] ?? field.fallback}</small>
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
                    checked={appearance.buttonStyle === style}
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
            data-button-style={appearance.buttonStyle}
            style={previewStyle}
          >
            <div className="appearance-phone-header">
              {meta.logo ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img alt="" className="preview-logo" src={meta.logo} />
              ) : (
                <LogoMark />
              )}
              <strong>{meta.title}</strong>
              <p>{meta.subtitle}</p>
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
            {badgeText ? (
              <span className="appearance-accent">{badgeText}</span>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
