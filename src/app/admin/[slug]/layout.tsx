import Link from "next/link";
import { notFound } from "next/navigation";
import { AdminPageSwitcher } from "@/components/layout/AdminPageSwitcher";
import { LogoMark } from "@/components/layout/LogoMark";
import { NavTabs } from "@/components/layout/NavTabs";
import { linkStore } from "@/lib/services";

export const dynamic = "force-dynamic";

export default async function PageAdminLayout({
  children,
  params,
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}>) {
  const { slug } = await params;
  const [page, pages] = await Promise.all([
    linkStore.getPage(slug),
    linkStore.getPages(),
  ]);
  if (!page) notFound();
  const livePath = slug === "home" ? "/" : `/${slug}`;

  return (
    <div className="admin-app">
      <header className="admin-nav">
        <Link href="/admin" className="admin-brand" aria-label="Admin home">
          <LogoMark />
          <span>Some Useful Links</span>
        </Link>
        <AdminPageSwitcher pages={pages} activeSlug={slug} />
        <NavTabs slug={slug} />
        <div className="admin-actions">
          <Link href={livePath} target="_blank">
            View live page
          </Link>
          <span aria-label="Signed in as MS">MS</span>
        </div>
      </header>
      <main className="admin-main">{children}</main>
    </div>
  );
}
