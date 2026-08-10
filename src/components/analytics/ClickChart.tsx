"use client";

import {
  Area,
  CartesianGrid,
  ComposedChart,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { AnalyticsPoint } from "@/lib/services/interfaces/analytics-store.interface";

export function ClickChart({ data }: { data: AnalyticsPoint[] }) {
  return (
    <div className="chart-area" aria-label="Views and clicks over time chart">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart
          data={data}
          margin={{ top: 18, right: 22, bottom: 0, left: 0 }}
        >
          <CartesianGrid vertical={false} stroke="#E5E2EC" strokeWidth={1} />
          <XAxis
            dataKey="date"
            ticks={[
              "2025-08-01",
              "2025-08-05",
              "2025-08-09",
              "2025-08-13",
              "2025-08-17",
              "2025-08-21",
              "2025-08-25",
            ]}
            axisLine={false}
            tickLine={false}
            tick={{ fill: "#6C6878", fontSize: 11 }}
            tickFormatter={(value: string) =>
              `Aug ${Number.parseInt(value.slice(-2), 10)}`
            }
            interval={0}
            padding={{ left: 30, right: 10 }}
          />
          <YAxis hide domain={[0, "dataMax + 160"]} />
          <Tooltip
            contentStyle={{
              border: "1px solid #E5E2EC",
              borderRadius: 10,
              boxShadow: "0 8px 24px rgba(42,39,56,.1)",
              fontSize: 12,
            }}
            labelFormatter={(value) => `Date: ${String(value)}`}
          />
          <Area
            type="monotone"
            dataKey="views"
            stroke="none"
            fill="#E8E4FB"
            fillOpacity={0.92}
            animationDuration={500}
          />
          <Line
            type="monotone"
            dataKey="views"
            stroke="#5C4FB3"
            strokeWidth={4}
            dot={false}
            activeDot={{ r: 5, fill: "#5C4FB3" }}
            animationDuration={500}
          />
          <Line
            type="monotone"
            dataKey="clicks"
            stroke="#4BB6AA"
            strokeWidth={3}
            strokeDasharray="8 7"
            dot={false}
            activeDot={{ r: 4, fill: "#4BB6AA" }}
            animationDuration={500}
          />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
