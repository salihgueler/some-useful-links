"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { label: "Links", segment: "links" },
  { label: "Analytics", segment: "analytics" },
  { label: "Appearance", segment: "appearance" },
  { label: "Share card", segment: "share" },
];

export function NavTabs({ slug }: { slug: string }) {
  const pathname = usePathname();

  return (
    <nav className="admin-tabs" aria-label="Admin sections">
      {tabs.map((tab) => {
        const href = `/admin/${slug}/${tab.segment}`;
        const active = pathname === href;
        return (
          <Link
            key={tab.label}
            href={href}
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
