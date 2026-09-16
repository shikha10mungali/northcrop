import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface ChartViewProps {
  type: "bar" | "line";
  data: Record<string, unknown>[];
  labelKey: string;
  valueKey: string;
}

/**
 * Generic chart component: knows nothing about banking data specifically,
 * just plots `valueKey` against `labelKey` from whatever rows it's given.
 */
export function ChartView({ type, data, labelKey, valueKey }: ChartViewProps) {
  if (data.length === 0) {
    return <p className="empty-state">No data to chart.</p>;
  }

  return (
    <div className="chart-wrapper">
      <ResponsiveContainer width="100%" height={280}>
        {type === "bar" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={labelKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Bar dataKey={valueKey} fill="#2563eb" radius={[4, 4, 0, 0]} />
          </BarChart>
        ) : (
          <LineChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey={labelKey} tick={{ fontSize: 12 }} />
            <YAxis tick={{ fontSize: 12 }} />
            <Tooltip />
            <Line
              type="monotone"
              dataKey={valueKey}
              stroke="#2563eb"
              strokeWidth={2}
              dot={{ r: 3 }}
            />
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
