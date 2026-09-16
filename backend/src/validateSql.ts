import { ALLOWED_TABLE_NAMES } from "./schemaAllowlist";
import { config } from "./config";

/**
 * The safety gate every generated SQL string must pass through before it
 * reaches the database, regardless of whether it came from the mocked
 * intent matcher or a real LLM. Throws SqlValidationError on any violation;
 * never silently mutates a query into something the caller didn't ask for
 * except for enforcing/capping LIMIT, which is documented below.
 */
export class SqlValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SqlValidationError";
  }
}

const FORBIDDEN_KEYWORDS = [
  "insert",
  "update",
  "delete",
  "drop",
  "alter",
  "truncate",
  "attach",
  "detach",
  "pragma",
  "create",
  "exec",
  "execute",
  "replace",
  "vacuum",
  "reindex",
  "grant",
  "revoke",
];

const FORBIDDEN_KEYWORD_PATTERN = new RegExp(
  `\\b(${FORBIDDEN_KEYWORDS.join("|")})\\b`,
  "i"
);

const TABLE_REFERENCE_PATTERN = /\b(?:FROM|JOIN)\s+([a-zA-Z_][a-zA-Z0-9_]*)/gi;

const LIMIT_PATTERN = /\bLIMIT\s+(\d+)\b/i;

function stripTrailingSemicolon(sql: string): string {
  const trimmed = sql.trim();
  return trimmed.endsWith(";") ? trimmed.slice(0, -1).trim() : trimmed;
}

function assertSingleStatement(sql: string): void {
  if (sql.includes(";")) {
    throw new SqlValidationError(
      "Multiple SQL statements are not allowed."
    );
  }
}

function assertNoComments(sql: string): void {
  if (sql.includes("--") || sql.includes("/*")) {
    throw new SqlValidationError("SQL comments are not allowed.");
  }
}

function assertSelectOnly(sql: string): void {
  if (!/^SELECT\b/i.test(sql)) {
    throw new SqlValidationError("Only SELECT statements are allowed.");
  }
}

function assertNoForbiddenKeywords(sql: string): void {
  const match = sql.match(FORBIDDEN_KEYWORD_PATTERN);
  if (match) {
    throw new SqlValidationError(
      `Forbidden keyword detected: ${match[0].toUpperCase()}`
    );
  }
}

function assertAllowedTables(sql: string): void {
  const matches = [...sql.matchAll(TABLE_REFERENCE_PATTERN)];
  if (matches.length === 0) {
    throw new SqlValidationError("No queryable table found in the statement.");
  }
  for (const match of matches) {
    const tableName = match[1].toLowerCase();
    if (!ALLOWED_TABLE_NAMES.includes(tableName)) {
      throw new SqlValidationError(
        `Table "${tableName}" is not in the allow-list.`
      );
    }
  }
}

function enforceLimit(sql: string): string {
  const existing = sql.match(LIMIT_PATTERN);

  if (!existing) {
    return `${sql} LIMIT ${config.maxRowLimit}`;
  }

  const requested = Number(existing[1]);
  if (requested > config.maxRowLimit) {
    return sql.replace(LIMIT_PATTERN, `LIMIT ${config.maxRowLimit}`);
  }

  return sql;
}

export function validateAndNormalizeSql(sql: string): string {
  if (typeof sql !== "string" || sql.trim().length === 0) {
    throw new SqlValidationError("SQL must be a non-empty string.");
  }

  const stripped = stripTrailingSemicolon(sql);

  assertSingleStatement(stripped);
  assertNoComments(stripped);
  assertSelectOnly(stripped);
  assertNoForbiddenKeywords(stripped);
  assertAllowedTables(stripped);

  return enforceLimit(stripped);
}
