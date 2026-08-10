import Link from "next/link";
import type { LinkEntry, LinkMeta } from "@/lib/config/links.types";
import { LogoMark } from "@/components/layout/LogoMark";

export function LivePreview({
  meta,
  links,
  pageSlug,
}: {
  meta: LinkMeta;
  links: LinkEntry[];
  pageSlug: string;
}) {
  return (
    <section className="live-preview">
      <header>
        <h2>Live page</h2>
        <span>
          <i /> Live
        </span>
      </header>
      <div className="live-preview-content">
        <div className="preview-phone">
          <LogoMark />
          <strong>{meta.title}</strong>
          <div>
            {links.slice(0, 3).map((link) => (
              <span key={link.id}>{link.label}</span>
            ))}
          </div>
        </div>
        <div className="preview-summary">
          <strong>Page is looking fresh ✦</strong>
          <p>
            Five links are live. Your most popular link is Design resources.
          </p>
          <Link href={`/admin/${pageSlug}/links`}>Edit links</Link>
        </div>
      </div>
    </section>
  );
}
