import type { QueryResponse } from "../types";
import { KpiCard } from "./KpiCard";
import { TableView } from "./TableView";
import { ChartView } from "./ChartView";

interface ResultRendererProps {
  response: QueryResponse;
}

/**
 * Dispatches on response.type alone -- this is what keeps the render logic
 * a clean switch instead of conditionals scattered across the chat window.
 */
export function ResultRenderer({ response }: ResultRendererProps) {
  return (
    <div className="result">
      <h3 className="result-title">{response.title}</h3>

      {response.type === "kpi" && (
        <KpiCard
          value={response.kpiValue ?? 0}
          label={response.kpiLabel ?? response.title}
        />
      )}

      {response.type === "table" && (
        <TableView columns={response.columns ?? []} rows={response.rows ?? []} />
      )}

      {(response.type === "bar" || response.type === "line") && (
        <ChartView
          type={response.type}
          data={response.rows ?? []}
          labelKey={response.chartLabelKey ?? ""}
          valueKey={response.chartValueKey ?? ""}
        />
      )}

      {response.type === "text" && (
        <p className="text-response">{response.message}</p>
      )}

      {response.sql && (
        <details className="sql-toggle">
          <summary>Show generated SQL</summary>
          <pre className="sql-block">{response.sql}</pre>
        </details>
      )}
    </div>
  );
}
