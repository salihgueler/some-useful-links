import type { ReferrerAnalytics } from "@/lib/services/interfaces/analytics-store.interface";

const barColors = ["#5C4FB3", "#4BB6AA", "#F48662", "#E4BF48"];

export function SourceBars({ rows }: { rows: ReferrerAnalytics[] }) {
  return (
    <section className="panel source-panel">
      <h2>Traffic sources</h2>
      <div className="source-list">
        {rows.map((row, index) => (
          <div className="source-row" key={row.source}>
            <div>
              <span>{row.source}</span>
              <span>{row.percentage}%</span>
            </div>
            <span className="source-track">
              <span
                style={{
                  width: `${row.percentage}%`,
                  backgroundColor: barColors[index % barColors.length],
                }}
              />
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
