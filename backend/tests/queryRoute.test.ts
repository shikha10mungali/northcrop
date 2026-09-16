import { describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";

const app = createApp();

describe("GET /health", () => {
  it("reports ok", async () => {
    const res = await request(app).get("/health");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ status: "ok" });
  });
});

describe("POST /api/query", () => {
  it("returns a kpi response for a recognized question", async () => {
    const res = await request(app)
      .post("/api/query")
      .send({ question: "how many total customers do we have" });

    expect(res.status).toBe(200);
    expect(res.body.type).toBe("kpi");
    expect(typeof res.body.kpiValue).toBe("number");
    expect(typeof res.body.sql).toBe("string");
    expect(res.body.sql.toUpperCase()).toContain("SELECT");
  });

  it("returns a bar-chart response with rows shaped for charting", async () => {
    const res = await request(app)
      .post("/api/query")
      .send({ question: "what is the total balance by branch" });

    expect(res.status).toBe(200);
    expect(res.body.type).toBe("bar");
    expect(Array.isArray(res.body.rows)).toBe(true);
    expect(res.body.rows.length).toBeGreaterThan(0);
    expect(res.body).toHaveProperty("chartLabelKey");
    expect(res.body).toHaveProperty("chartValueKey");
  });

  it("returns a table response with columns derived from the row shape", async () => {
    const res = await request(app)
      .post("/api/query")
      .send({ question: "recent transactions" });

    expect(res.status).toBe(200);
    expect(res.body.type).toBe("table");
    expect(Array.isArray(res.body.columns)).toBe(true);
    expect(res.body.columns.length).toBeGreaterThan(0);
    expect(res.body.rows.length).toBeLessThanOrEqual(20);
  });

  it("degrades gracefully to a 200 text response for an unmatched question", async () => {
    const res = await request(app)
      .post("/api/query")
      .send({ question: "what is the weather today" });

    expect(res.status).toBe(200);
    expect(res.body.type).toBe("text");
    expect(res.body.message).toMatch(/couldn't map/i);
  });

  it("rejects a too-short question with 400", async () => {
    const res = await request(app).post("/api/query").send({ question: "hi" });

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("rejects a missing question field with 400", async () => {
    const res = await request(app).post("/api/query").send({});

    expect(res.status).toBe(400);
    expect(res.body).toHaveProperty("error");
  });

  it("has no effect when the question text contains SQL-looking content", async () => {
    const res = await request(app)
      .post("/api/query")
      .send({ question: "total balance by branch; DROP TABLE customers;" });

    // The injected fragment is just NL text -- it can only ever steer
    // keyword matching, never reach SQL directly, so this either matches
    // the balance-by-branch intent or falls back to text. Either way the
    // database is untouched and the server responds normally.
    expect(res.status).toBe(200);
    expect(["bar", "text"]).toContain(res.body.type);
  });
});
