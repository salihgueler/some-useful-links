import type { ReactNode } from "react";
import { Badge } from "@/components/ui/Badge";

interface KPIPanelProps {
  label: string;
  value: string;
  trend: number;
  icon: ReactNode;
  tone: string;
}

export function KPIPanel({
  label,
  value,
  trend,
  icon,
  tone,
}: KPIPanelProps) {
  return (
    <article className="kpi-panel">
      <span className="kpi-label">{label}</span>
      <span className={`kpi-icon ${tone}`}>{icon}</span>
      <strong>{value}</strong>
      <div className="kpi-meta">
        <Badge>+{trend.toFixed(1)}%</Badge>
        <span>vs previous</span>
      </div>
    </article>
  );
}
