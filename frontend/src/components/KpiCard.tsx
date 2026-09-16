interface KpiCardProps {
  value: string | number;
  label: string;
}

export function KpiCard({ value, label }: KpiCardProps) {
  const formatted =
    typeof value === "number" ? value.toLocaleString("en-IN") : value;

  return (
    <div className="kpi-card">
      <div className="kpi-value">{formatted}</div>
      <div className="kpi-label">{label}</div>
    </div>
  );
}
