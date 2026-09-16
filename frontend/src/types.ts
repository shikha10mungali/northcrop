export type ResponseType = "text" | "table" | "kpi" | "bar" | "line";

/**
 * Mirrors the backend's QueryResponse contract (backend/src/types.ts) so the
 * ResultRenderer can switch on `type` alone instead of guessing the shape.
 */
export interface QueryResponse {
  type: ResponseType;
  title: string;
  sql: string;
  columns?: string[];
  rows?: Record<string, unknown>[];
  kpiValue?: string | number;
  kpiLabel?: string;
  chartLabelKey?: string;
  chartValueKey?: string;
  message?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  question?: string;
  response?: QueryResponse;
  error?: string;
}
