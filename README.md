# Conversational Data Analyst

A full-stack app for a banking use case: a chat interface where a user asks
natural-language questions and gets back a KPI card, table, bar chart, or
line chart, backed by a real SQLite database of synthetic banking data.

Built as a technical screening assignment. **AI tool disclosure**: implemented
with [Claude Code](https://claude.com/claude-code) (Claude Sonnet 5), used
interactively file-by-file with review, type-checking, the automated test
suite, and live browser testing at each step rather than one bulk generation.

## Architecture

```
React chat UI (Vite dev server, :5173)
     │  POST /api/query { question }         (proxied to :4000 in dev)
     ▼
Express route (backend/src/routes/query.ts)
     │  1. zod validates the request body (400 on failure)
     ▼
generateSqlFromQuestion(question)             backend/src/nlToSql.ts
     │  keyword-matched intents -> SQL template ("AI" layer, mocked)
     │  output is untrusted regardless of source
     ▼
validateAndNormalizeSql(sql)                  backend/src/validateSql.ts
     │  the safety gate -- throws (422) on any violation, otherwise
     │  returns a cleaned, LIMIT-capped SQL string
     ▼
db.prepare(sql).all()                         SQLite, PRAGMA query_only = ON
     │
     ▼
shapeResponse() -> { type: "kpi"|"table"|"bar"|"line"|"text", ... }
     │
     ▼
ResultRenderer dispatches on `type` -> KpiCard / TableView / ChartView
```

The generation step (`nlToSql.ts`) and the safety step (`validateSql.ts`) are
deliberately separate functions. The source of the SQL -- a keyword matcher
today, any LLM tomorrow -- is never the trust boundary; the validator is.

## Project structure

```
backend/
  src/
    config.ts            env var loading
    db.ts                read-only SQLite connection (PRAGMA query_only)
    schemaAllowlist.ts    single source of truth for queryable tables/columns
    seed.ts               schema DDL + synthetic data generator
    nlToSql.ts             question -> candidate SQL (mocked "AI" layer)
    validateSql.ts          the safety gate -- validateAndNormalizeSql()
    types.ts                QueryResponse contract
    routes/query.ts         POST /api/query orchestration + response shaping
    index.ts                 Express app wiring
  tests/validateSql.test.ts  9 tests, one per validation rule
  tests/queryRoute.test.ts   8 tests, full HTTP request -> response flow
frontend/
  src/
    types.ts               QueryResponse/ChatMessage, mirrors the backend
    api.ts                  askQuestion() fetch wrapper
    components/
      ChatWindow.tsx        message state, composer, sample question chips
      ResultRenderer.tsx    dispatches on response.type
      KpiCard.tsx / TableView.tsx / ChartView.tsx
```

## Setup

Requires Node 20+ (tested on Node 20.12.2) and npm.

**Backend**

```bash
cd backend
npm install
cp .env.example .env
npm run seed     # creates backend/data/bank.db with synthetic data
npm run dev      # http://localhost:4000
```

**Frontend** (separate terminal)

```bash
cd frontend
npm install
npm run dev      # http://localhost:5173, proxies /api to :4000
```

Open `http://localhost:5173` and ask a question, or click one of the sample
chips.

**Tests**

```bash
cd backend
npm test         # re-seeds the db, then runs all vitest suites (17 tests):
                  # validateSql.test.ts (the safety-layer rules) and
                  # queryRoute.test.ts (full HTTP request -> response flow)
```

## Database

Two logically distinct datasets, seeded with realistic synthetic volume
(120 customers, ~198 accounts, 3000 transactions):

- **Customer/branch/account**: `branches`, `customers` (with `kyc_status`),
  `accounts` (with `balance`, `status`)
- **Transactions**: `transactions`, referencing `accounts`

Full DDL is in `backend/src/seed.ts`. Re-run `npm run seed` at any point to
reset the database to a fresh synthetic dataset.

## Completed functionality

- Chat interface with message history, loading state, and sample questions
- 10 natural-language intents covering all four response types (KPI, table,
  bar chart, line chart) plus a graceful fallback for unmatched questions
- SQL safety gate enforcing: single statement only, SELECT-only, a
  forbidden-keyword blocklist, a table allow-list, and an enforced/capped
  `LIMIT` -- with 9 passing unit tests (one per rule) plus 8 integration
  tests exercising the real HTTP route end-to-end (17 tests total)
- Verified production builds for both backend (`tsc`) and frontend
  (`vite build`), each booted and confirmed serving real requests
- Read-only DB connection (`PRAGMA query_only = ON`) as defense in depth,
  independent of the validator
- Input validation via zod (400 on bad input), distinct error handling for
  validation failures (422), unmatched questions (200, friendly text), and
  unexpected errors (500, generic message to the client, real error logged
  server-side)
- "Show generated SQL" toggle on every answer for transparency
- Verified end-to-end in a real browser against both running servers

## Assumptions

- Single currency (INR) and single-tenant, trusted-user context -- no
  authentication, since the brief scopes this as a data-analyst demo
- SQLite chosen over Postgres/MySQL for a deterministic, zero-dependency
  local setup; the schema avoids SQLite-specific features so it ports to
  Postgres with minimal changes (`INTEGER PRIMARY KEY` -> `SERIAL PRIMARY
  KEY`, etc.)
- The NL layer is a mocked keyword matcher standing in for a real LLM call,
  as explicitly permitted by the brief ("mocked AI implementation")
- Seeded transaction dates are relative to when `npm run seed` is run (last
  180 days), not fixed calendar dates

## Known limitations

- **NL coverage is limited to ~10 intents.** An unrecognized question
  returns a friendly fallback rather than a guess; there's no real LLM
  wired in (kept mocked deliberately, so the app has zero runtime
  dependency on a live API key or network call).
- **SQL validation is regex-based, not a real parser.** The forbidden-keyword
  blocklist matches whole words anywhere in the string, including inside a
  string literal -- e.g. a search for a customer literally named `"DROP"`
  would be (incorrectly) rejected. A production version would use a real
  SQL AST parser (e.g. `node-sql-parser`) for precise, context-aware checks.
- **Column-level allow-listing is declared but not enforced.**
  `schemaAllowlist.ts` lists allowed columns per table, but the validator
  only checks table names referenced in `FROM`/`JOIN`, not the columns in
  the `SELECT` list. Every current query template only selects
  allow-listed columns, but the validator doesn't independently guarantee
  that for a hypothetical future generator.
- **`QUERY_TIMEOUT_MS` is read but not enforced.** `better-sqlite3` executes
  synchronously, so there's no way to cancel a long-running query
  mid-flight from Node; a Postgres-backed version would set a real
  `statement_timeout` on the connection.
- **No authentication or per-user audit logging** -- important for a real
  banking deployment, deliberately out of scope for this demo.
- **No rate limiting** on `/api/query`.
- Dev-only `vite`/`esbuild` advisories (moderate/high, dev-server only, no
  fix available yet without breaking Node 20 compatibility) remain in
  `frontend/package-lock.json`; they don't affect the production build
  output, only the local dev server.
- The production frontend bundle is ~530 kB minified (mostly `recharts`),
  above Vite's default 500 kB warning threshold. Fine for this demo's
  single-page scope; a larger app would code-split the chart library
  behind a dynamic `import()`.

## Productionisation approach

- Swap SQLite for managed Postgres with a dedicated **read-only role** for
  this query path, plus a real `statement_timeout`
- Replace the regex validator's blocklist/table-list checks with a proper
  SQL AST parser for precise validation, and enforce column-level
  allow-listing, not just tables
- Wire in a real LLM (schema-aware system prompt, SELECT-only instruction)
  behind the same `generateSqlFromQuestion` interface -- the validator
  doesn't change, since it was never trusting the generator
- Add authentication (SSO/JWT), and audit-log every question, the SQL that
  ran, and the row count returned -- standard for a banking data-access
  path
- Add rate limiting and structured request logging/tracing
- CI running typecheck, lint, and the test suite on every PR
- Containerize both services and deploy behind an API gateway

## What I'd cut first under more time pressure vs. what I'd add

Cut: NL intent coverage (already the smallest, most mechanical piece to
extend). Kept non-negotiable: the validation layer and its tests, since
that's the requirement the brief calls out explicitly. Next to add: a real
LLM behind the existing interface, and column-level validation.
