import { Router } from "express";
import { z } from "zod";
import { db } from "../db";
import { generateSqlFromQuestion, NoMatchError, type GeneratedQuery } from "../nlToSql";
import { validateAndNormalizeSql, SqlValidationError } from "../validateSql";
import type { QueryResponse } from "../types";

export const queryRouter = Router();

const requestSchema = z.object({
  question: z
    .string()
    .trim()
    .min(3, "Question must be at least 3 characters.")
    .max(300, "Question must be at most 300 characters."),
});

function shapeResponse(
  generated: GeneratedQuery,
  sql: string,
  rows: Record<string, unknown>[]
): QueryResponse {
  const base = { type: generated.type, title: generated.title, sql };

  switch (generated.type) {
    case "kpi": {
      const firstRow = rows[0] ?? {};
      const firstValue = Object.values(firstRow)[0];
      return {
        ...base,
        kpiValue: (firstValue as string | number | undefined) ?? 0,
        kpiLabel: generated.kpiLabel ?? generated.title,
      };
    }
    case "bar":
    case "line":
      return {
        ...base,
        rows,
        chartLabelKey: generated.chartLabelKey,
        chartValueKey: generated.chartValueKey,
      };
    case "table":
      return {
        ...base,
        columns: rows.length > 0 ? Object.keys(rows[0]) : [],
        rows,
      };
    case "text":
      return { ...base, message: generated.title };
  }
}

queryRouter.post("/", async (req, res) => {
  const parsed = requestSchema.safeParse(req.body);

  if (!parsed.success) {
    res.status(400).json({
      error: parsed.error.issues.map((issue) => issue.message).join(" "),
    });
    return;
  }

  const { question } = parsed.data;

  try {
    const generated = await generateSqlFromQuestion(question);
    const safeSql = validateAndNormalizeSql(generated.sql);
    const rows = db.prepare(safeSql).all() as Record<string, unknown>[];
    const response = shapeResponse(generated, safeSql, rows);

    res.status(200).json(response);
    return;
  } catch (err) {
    if (err instanceof NoMatchError) {
      const response: QueryResponse = {
        type: "text",
        title: "I couldn't understand that",
        sql: "",
        message: err.message,
      };
      res.status(200).json(response);
      return;
    }

    if (err instanceof SqlValidationError) {
      res.status(422).json({ error: err.message });
      return;
    }

    console.error("Unexpected error handling /api/query:", err);
    res.status(500).json({ error: "Something went wrong processing your question." });
  }
});
