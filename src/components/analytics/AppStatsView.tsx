import type { AppStatsDay } from "@/lib/services/interfaces/app-stats.interface";

/**
 * The operator's app-wide view: a growth curve over a dense daily table.
 *
 * A server component on purpose -- there is no range selector and no
 * interaction, so no client JavaScript ships. The date window is a URL
 * parameter, which keeps this a plain server render and means the page has no
 * API endpoint of its own to secure.
 *
 * Chart maxima are derived from the data rather than fixed, so a flat series
 * still fills its box instead of hugging the floor.
 */

const NUM = new Intl.NumberFormat("en-GB");

interface SeriesConfig {
  values: number[];
  color: string;
}

/** Builds an SVG polyline path, plus the closing edge for an area fill. */
function linePath(values: number[], width: number, height: number, pad: number, max: number) {
  if (values.length === 0) return "";
  const step = values.length > 1 ? (width - pad * 2) / (values.length - 1) : 0;
  return values
    .map((value, index) => {
      const x = pad + index * step;
      const y = height - pad - (max === 0 ? 0 : value / max) * (height - pad * 2);
      return `${index === 0 ? "M" : "L"}${x.toFixed(1)} ${y.toFixed(1)}`;
    })
    .join(" ");
}

function areaPath(values: number[], width: number, height: number, pad: number, max: number) {
  const line = linePath(values, width, height, pad, max);
  if (!line) return "";
  return `${line} L${(width - pad).toFixed(1)} ${(height - pad).toFixed(1)} L${pad} ${(
    height - pad
  ).toFixed(1)} Z`;
}

function GrowthChart({
  series,
  max,
  dates,
}: {
  series: SeriesConfig[];
  max: number;
  dates: string[];
}) {
  const width = 960;
  const height = 220;
  const pad = 24;
  // Four gridlines, labelled, so the shape carries values and not just a trend.
  const ticks = [0, 1, 2, 3].map((index) => ({
    value: Math.round((max / 3) * (3 - index)),
    y: pad + index * ((height - pad * 2) / 3),
  }));

  // Roughly five dates, evenly spaced. A line without dates shows a shape but
  // says nothing about when, and the table below is too far away to serve as
  // the chart's axis.
  const labelEvery = Math.max(1, Math.ceil(dates.length / 5));
  const step = dates.length > 1 ? (width - pad * 2) / (dates.length - 1) : 0;
  const dateLabels = dates
    .map((date, index) => ({ date, index }))
    .filter(({ index }) => index % labelEvery === 0 || index === dates.length - 1);

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className="app-stats-chart"
      role="img"
      aria-label={`Owners and collections over time, ${dates.at(0)} to ${dates.at(-1)}`}
    >
      {ticks.map((tick) => (
        <g key={tick.y}>
          <line x1={pad} y1={tick.y} x2={width - pad} y2={tick.y} className="app-stats-grid" />
          <text x={0} y={tick.y + 4} className="app-stats-tick">
            {tick.value}
          </text>
        </g>
      ))}
      {series.map((item) => (
        <path
          key={`${item.color}-area`}
          d={areaPath(item.values, width, height, pad, max)}
          fill={item.color}
          opacity={0.1}
        />
      ))}
      {series.map((item) => (
        <path
          key={`${item.color}-line`}
          d={linePath(item.values, width, height, pad, max)}
          fill="none"
          stroke={item.color}
          strokeWidth={2.5}
          strokeLinejoin="round"
        />
      ))}
      {dateLabels.map(({ date, index }) => (
        <text
          key={date}
          x={pad + index * step}
          y={height - 4}
          className="app-stats-tick"
          textAnchor={index === 0 ? "start" : index === dates.length - 1 ? "end" : "middle"}
        >
          {date.slice(5)}
        </text>
      ))}
    </svg>
  );
}

export function AppStatsView({ days }: { days: AppStatsDay[] }) {
  if (days.length === 0) {
    return (
      <div className="app-stats-empty">
        <p className="app-stats-empty-title">No rollup yet</p>
        <p className="app-stats-empty-body">
          App-wide numbers are rebuilt once a night, just after midnight
          (Europe/Berlin). This page fills in after the first run.
        </p>
      </div>
    );
  }

  const totals = days.reduce(
    (sum, day) => ({
      views: sum.views + day.views,
      clicks: sum.clicks + day.clicks,
      shares: sum.shares + day.shares,
    }),
    { views: 0, clicks: 0, shares: 0 },
  );
  const clickRate = totals.views === 0 ? 0 : Math.round((totals.clicks / totals.views) * 100);
  const latest = days[days.length - 1];

  const owners = days.map((day) => day.totalOwners);
  const collections = days.map((day) => day.totalPages);
  // A shared axis so the two series stay visually comparable; +1 avoids a zero
  // divisor on a brand-new install where every value is 0.
  const growthMax = Math.max(...owners, ...collections, 1);

  const strip = [
    { label: "Owners", value: NUM.format(latest.totalOwners) },
    { label: "Collections", value: NUM.format(latest.totalPages) },
    { label: "Views", value: NUM.format(totals.views) },
    { label: "Clicks", value: NUM.format(totals.clicks) },
    { label: "Click rate", value: `${clickRate}%` },
    { label: "Shares", value: NUM.format(totals.shares) },
  ];

  return (
    <div className="app-stats">
      <section className="app-stats-panel">
        <h2 className="app-stats-panel-title">Owners and collections over time</h2>
        <GrowthChart
          max={growthMax}
          dates={days.map((day) => day.date)}
          series={[
            { values: collections, color: "var(--positive)" },
            { values: owners, color: "var(--primary)" },
          ]}
        />
        <ul className="app-stats-legend">
          <li>
            <span className="app-stats-swatch" style={{ background: "var(--primary)" }} />
            Owners
          </li>
          <li>
            <span className="app-stats-swatch" style={{ background: "var(--positive)" }} />
            Collections
          </li>
        </ul>
      </section>

      <ul className="app-stats-strip">
        {strip.map((item) => (
          <li key={item.label}>
            <span className="app-stats-strip-label">{item.label}</span>
            <span className="app-stats-strip-value">{item.value}</span>
          </li>
        ))}
      </ul>

      <section className="app-stats-panel">
        <h2 className="app-stats-panel-title">Every day</h2>
        <div className="app-stats-table-wrap">
          <table className="app-stats-table">
            <thead>
              <tr>
                <th scope="col">Date</th>
                <th scope="col">Views</th>
                <th scope="col">Clicks</th>
                <th scope="col">Shares</th>
                <th scope="col">Active owners</th>
                <th scope="col">Active collections</th>
                <th scope="col">Owners</th>
                <th scope="col">Collections</th>
              </tr>
            </thead>
            <tbody>
              {[...days].reverse().map((day) => (
                <tr key={day.date}>
                  <th scope="row">{day.date}</th>
                  <Cell value={day.views} />
                  <Cell value={day.clicks} />
                  <Cell value={day.shares} />
                  <Cell value={day.activeOwners} />
                  <Cell value={day.activePages} />
                  <Cell value={day.totalOwners} />
                  <Cell value={day.totalPages} />
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

/** Zeros are dimmed so a scan lands on the days that carry data. */
function Cell({ value }: { value: number }) {
  return <td className={value === 0 ? "app-stats-zero" : undefined}>{NUM.format(value)}</td>;
}
