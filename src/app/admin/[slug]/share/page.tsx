import { notFound } from "next/navigation";
import { ShareCardPanel } from "@/components/share/ShareCardPanel";
import { linkStore } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function SharePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const page = await linkStore.getPage(slug);
  if (!page) notFound();

  return (
    <div className="admin-editor admin-share-page">
      <header className="editor-heading">
        <div>
          <p className="eyebrow">/{page.slug}</p>
          <h1>Share card</h1>
          <p>Download a social image or copy the public page URL.</p>
        </div>
      </header>
      <section className="admin-share-workspace">
        <div className="share-workspace-copy">
          <h2>Ready to share</h2>
          <p>
            The QR code points to <strong>{page.meta.url}</strong>. Colors and
            copy follow this page&apos;s current appearance.
          </p>
          <div className="share-specs">
            <span><strong>1200 × 630</strong>Social image</span>
            <span><strong>PNG</strong>Download format</span>
            <span><strong>Live QR</strong>Canonical URL</span>
          </div>
        </div>
        <ShareCardPanel page={page} className="admin-share-card" />
      </section>
    </div>
  );
}
