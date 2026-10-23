import type { CSSProperties } from "react";
import { Footer } from "@/components/layout/Footer";
import { LogoMark } from "@/components/layout/LogoMark";
import { LinkList } from "@/components/links/LinkList";
import { VisitorTracker } from "@/components/links/VisitorTracker";
import { ShareExperience } from "@/components/share/ShareExperience";
import type { PageConfiguration } from "@/lib/config/links.types";
import { borderOn, readableInk, softInk, surfaceOn } from "@/lib/color";

type PageStyle = CSSProperties & Record<`--page-${string}`, string>;

/** Shown when a page has never set one; an empty string hides the badge. */
export const DEFAULT_BADGE = "Curated with care";

export function PublicLinkPage({ page }: { page: PageConfiguration }) {
  const { appearance, meta } = page;

  // Two surfaces, two foregrounds. The header band and the body can be very
  // different colours (navy over white in the AWS preset), so each gets ink
  // derived from the surface it actually sits on.
  const headerInk = readableInk(appearance.headerColor);
  const bodyInk = appearance.inkColor ?? readableInk(appearance.backgroundColor);
  const badge = appearance.badgeColor ?? "#FFD9C3";

  const style: PageStyle = {
    "--page-primary": appearance.primaryColor,
    "--page-header": appearance.headerColor,
    "--page-background": appearance.backgroundColor,
    "--page-accent": appearance.accentColor,
    "--page-logo": appearance.logoColor,
    "--page-ink": bodyInk,
    "--page-ink-soft": softInk(appearance.backgroundColor, bodyInk),
    "--page-header-ink": headerInk,
    "--page-header-ink-soft": softInk(appearance.headerColor, headerInk),
    "--page-border": borderOn(appearance.backgroundColor),
    "--page-surface": surfaceOn(appearance.backgroundColor),
    "--page-badge": badge,
    "--page-badge-ink": readableInk(badge),
  };

  const badgeText = meta.badge ?? DEFAULT_BADGE;

  return (
    <main
      className="visitor-page"
      data-button-style={appearance.buttonStyle}
      style={style}
    >
      <VisitorTracker pageSlug={page.slug} />
      <div className="visitor-shell">
        <ShareExperience page={page}>
          <header className="visitor-header motion-safe:animate-fade-up">
            {meta.logo ? (
              /* Owner-supplied logo replaces the built-in mark. Decorative:
                 the page title immediately below carries the same meaning. */
              // eslint-disable-next-line @next/next/no-img-element
              <img alt="" className="visitor-logo" src={meta.logo} />
            ) : (
              <LogoMark size="large" />
            )}
            <h1>{meta.title}</h1>
            <p>{meta.subtitle}</p>
          </header>
          {/* Outside the header on purpose: as an absolutely-positioned element
              straddling the band's edge, its legibility depended on a magic
              offset between the band and the header. In normal flow below the
              band it always sits on the body surface, so its colour is judged
              against one known background. */}
          {badgeText ? <p className="curated-label">{badgeText}</p> : null}
          <LinkList pageSlug={page.slug} links={page.links} />
        </ShareExperience>
        <Footer />
      </div>
    </main>
  );
}
