import { describe, expect, it } from "vitest";
import { validateAndNormalizeSql, SqlValidationError } from "../src/validateSql";
import { config } from "../src/config";

describe("validateAndNormalizeSql", () => {
  it("allows a well-formed SELECT and injects the default LIMIT", () => {
    const sql = `
      SELECT b.name, SUM(a.balance) AS total
      FROM accounts a
      JOIN customers c ON c.id = a.customer_id
      JOIN branches b ON b.id = c.branch_id
      GROUP BY b.name
    `;

    const result = validateAndNormalizeSql(sql);

    expect(result).toContain(`LIMIT ${config.maxRowLimit}`);
  });

  it("strips a single trailing semicolon instead of rejecting it", () => {
    const result = validateAndNormalizeSql("SELECT * FROM branches;");

    expect(result).not.toContain(";");
  });

  it("rejects stacked/multiple statements", () => {
    expect(() =>
      validateAndNormalizeSql(
        "SELECT * FROM customers; DROP TABLE customers;"
      )
    ).toThrow(SqlValidationError);
  });

  it("rejects statements that are not SELECT", () => {
    expect(() =>
      validateAndNormalizeSql("DELETE FROM accounts WHERE id = 1")
    ).toThrow(SqlValidationError);

    expect(() =>
      validateAndNormalizeSql("UPDATE accounts SET balance = 0")
    ).toThrow(SqlValidationError);

    expect(() =>
      validateAndNormalizeSql("INSERT INTO accounts (id) VALUES (1)")
    ).toThrow(SqlValidationError);
  });

  it("rejects a single statement containing a forbidden keyword", () => {
    expect(() =>
      validateAndNormalizeSql(
        "SELECT * FROM customers WHERE full_name = 'x' AND drop = 1"
      )
    ).toThrow(SqlValidationError);
  });

  it("rejects queries referencing a table outside the allow-list", () => {
    expect(() => validateAndNormalizeSql("SELECT * FROM admin_users")).toThrow(
      SqlValidationError
    );
  });

  it("caps an oversized LIMIT at MAX_ROW_LIMIT", () => {
    const result = validateAndNormalizeSql(
      "SELECT * FROM customers LIMIT 999999"
    );

    expect(result).toContain(`LIMIT ${config.maxRowLimit}`);
    expect(result).not.toContain("999999");
  });

  it("keeps a LIMIT that is already within the allowed cap", () => {
    const result = validateAndNormalizeSql("SELECT * FROM customers LIMIT 10");

    expect(result).toContain("LIMIT 10");
  });

  it("rejects empty or non-string input", () => {
    expect(() => validateAndNormalizeSql("")).toThrow(SqlValidationError);
    expect(() => validateAndNormalizeSql("   ")).toThrow(SqlValidationError);
  });
});
