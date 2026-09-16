import type { ResponseType } from "./nlToSql";

/**
 * The response contract every /api/query call returns. The frontend mirrors
 * this shape so its ResultRenderer can switch on `type` alone.
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
