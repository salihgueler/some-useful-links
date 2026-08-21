"use client";

import { useState, useTransition } from "react";
import {
  ArrowUpRight,
  Eye,
  MousePointer2,
  Percent,
  Share2,
} from "lucide-react";
import type { LinkEntry, LinkMeta } from "@/lib/config/links.types";
import type { AnalyticsSummary } from "@/lib/services";
import { ClickChart } from "./ClickChart";
import { KPIPanel } from "./KPIPanel";
import { LivePreview } from "./LivePreview";
import { CountryPanel } from "./CountryPanel";
import { SourceBars } from "./SourceBars";
import { TopLinks } from "./TopLinks";

interface AnalyticsDashboardProps {
  initialData: AnalyticsSummary;
  pageSlug: string;
  meta: LinkMeta;
  links: LinkEntry[];
}

export function AnalyticsDashboard({
  initialData,
  pageSlug,
  meta,
  links,
}: AnalyticsDashboardProps) {
  const [data, setData] = useState(initialData);
  const [isPending, startTransition] = useTransition();

  const changeRange = (range: string) => {
    startTransition(async () => {
      const response = await fetch(
        `/app-api/analytics?range=${range}&pageSlug=${encodeURIComponent(pageSlug)}`,
      );
      if (!response.ok) return;
      setData((await response.json()) as AnalyticsSummary);
    });
  };

  return (
    <div className={isPending ? "dashboard-content refreshing" : "dashboard-content"}>
      <div className="dashboard-title-row">
        <div>
          <h1>Good links, good clicks.</h1>
          <p>A clear look at how your page is doing.</p>
        </div>
        <label className="range-select">
          <span className="sr-only">Analytics date range</span>
          <select defaultValue="30" onChange={(event) => changeRange(event.target.value)}>
            <option value="7">Last 7 days</option>
            <option value="30">Last 30 days</option>
            <option value="90">Last 90 days</option>
            <option value="all">All time</option>
          </select>
        </label>
      </div>

      <section className="kpi-grid" aria-label="Analytics summary">
        <KPIPanel
          label="Page views"
          value={data.totals.views.toLocaleString("en-US")}
          trend={data.trends.views}
          icon={<ArrowUpRight size={17} />}
          tone="violet"
        />
        <KPIPanel
          label="Link clicks"
          value={data.totals.clicks.toLocaleString("en-US")}
          trend={data.trends.clicks}
          icon={<MousePointer2 size={16} />}
          tone="teal"
        />
        <KPIPanel
          label="Click rate"
          value={`${data.totals.clickRate.toFixed(1)}%`}
          trend={data.trends.clickRate}
          icon={<Percent size={17} />}
          tone="peach"
        />
        <KPIPanel
          label="Shares"
          value={data.totals.shares.toLocaleString("en-US")}
          trend={data.trends.shares}
          icon={<Share2 size={16} />}
          tone="yellow"
        />
      </section>

      <section className="analytics-main-grid">
        <section className="panel chart-panel">
          <header className="panel-heading">
            <div>
              <h2>Clicks over time</h2>
              <p>Daily page views and link clicks</p>
            </div>
            <div className="chart-legend" aria-hidden="true">
              <span><i className="views" />Views</span>
              <span><i className="clicks" />Clicks</span>
            </div>
          </header>
          <ClickChart data={data.timeline} />
        </section>
        <LivePreview meta={meta} links={links} pageSlug={pageSlug} />
        <TopLinks rows={data.topLinks} links={links} />
        <SourceBars rows={data.referrers} />
      </section>

      <CountryPanel countries={data.countries ?? []} />
    </div>
  );
}
