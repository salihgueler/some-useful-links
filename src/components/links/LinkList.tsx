"use client";

import { ChevronRight } from "lucide-react";
import type { LinkEntry } from "@/lib/config/links.types";
import { LinkIcon } from "./LinkIcon";

interface LinkListProps {
  pageSlug: string;
  links: LinkEntry[];
}

function trackClick(pageSlug: string, linkId: string) {
  const body = JSON.stringify({ type: "link-click", pageSlug, linkId });
  if (navigator.sendBeacon) {
    navigator.sendBeacon(
      "/api/track",
      new Blob([body], { type: "application/json" }),
    );
    return;
  }
  void fetch("/api/track", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body,
    keepalive: true,
  });
}

export function LinkList({ pageSlug, links }: LinkListProps) {
  return (
    <nav className="link-list" aria-label="Useful links">
      {links.map((link, index) => (
        <a
          className="link-row motion-safe:animate-fade-up"
          href={link.url}
          key={link.id}
          onClick={() => trackClick(pageSlug, link.id)}
          style={{ animationDelay: `${165 + index * 45}ms` }}
          target={link.url.startsWith("mailto:") ? undefined : "_blank"}
          rel={link.url.startsWith("mailto:") ? undefined : "noreferrer"}
        >
          <LinkIcon
            value={link.icon.emoji}
            backgroundColor={link.icon.backgroundColor}
          />
          <span className="link-copy">
            <strong>{link.label}</strong>
            {link.caption ? <span>{link.caption}</span> : null}
          </span>
          <ChevronRight className="link-chevron" size={19} strokeWidth={2.2} />
        </a>
      ))}
    </nav>
  );
}
