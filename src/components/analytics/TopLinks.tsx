import type { LinkEntry } from "@/lib/config/links.types";
import type { LinkAnalytics } from "@/lib/services/interfaces/analytics-store.interface";

interface TopLinksProps {
  rows: LinkAnalytics[];
  links: LinkEntry[];
}

export function TopLinks({ rows, links }: TopLinksProps) {
  const linkLookup = new Map(links.map((link) => [link.id, link]));

  return (
    <section className="panel top-links-panel">
      <header className="panel-heading">
        <h2>Top links</h2>
        <button type="button">View all</button>
      </header>
      <div className="top-links-labels" aria-hidden="true">
        <span>Link</span>
        <span>Clicks</span>
        <span>Rate</span>
      </div>
      <div className="top-links-list">
        {rows.slice(0, 3).map((row) => {
          const link = linkLookup.get(row.id);
          return (
            <article className="top-link-row" key={row.id}>
              <span
                className="mini-link-icon"
                style={{ backgroundColor: link?.icon.backgroundColor }}
              >
                {link?.icon.emoji ?? row.label.slice(0, 1)}
              </span>
              <span className="top-link-name">
                <strong>{row.label}</strong>
                <small>{row.id}</small>
              </span>
              <span className="top-link-clicks">
                {row.clicks.toLocaleString("en-US")}
              </span>
              <span className="top-link-rate">{row.rate.toFixed(1)}%</span>
            </article>
          );
        })}
      </div>
    </section>
  );
}
