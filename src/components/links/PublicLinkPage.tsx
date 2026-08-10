import type { CSSProperties } from "react";
import { Footer } from "@/components/layout/Footer";
import { LogoMark } from "@/components/layout/LogoMark";
import { LinkList } from "@/components/links/LinkList";
import { VisitorTracker } from "@/components/links/VisitorTracker";
import { ShareExperience } from "@/components/share/ShareExperience";
import type { PageConfiguration } from "@/lib/config/links.types";

type PageStyle = CSSProperties & Record<`--page-${string}`, string>;

export function PublicLinkPage({ page }: { page: PageConfiguration }) {
  const style: PageStyle = {
    "--page-primary": page.appearance.primaryColor,
    "--page-header": page.appearance.headerColor,
    "--page-background": page.appearance.backgroundColor,
    "--page-accent": page.appearance.accentColor,
    "--page-logo": page.appearance.logoColor,
  };

  return (
    <main
      className="visitor-page"
      data-button-style={page.appearance.buttonStyle}
      style={style}
    >
      <VisitorTracker pageSlug={page.slug} />
      <div className="visitor-shell">
        <ShareExperience page={page}>
          <header className="visitor-header motion-safe:animate-fade-up">
            <span className="header-sparkle" aria-hidden="true">
              ✦
            </span>
            <LogoMark size="large" />
            <h1>{page.meta.title}</h1>
            <p>{page.meta.subtitle}</p>
            <span className="curated-label">Curated with care</span>
          </header>
          <LinkList pageSlug={page.slug} links={page.links} />
        </ShareExperience>
        <Footer />
      </div>
    </main>
  );
}
