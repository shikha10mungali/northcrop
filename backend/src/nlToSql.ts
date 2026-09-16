/**
 * Stands in for a real LLM call: a small set of keyword-matched intents,
 * each mapping to a hand-written SQL template. The output here is treated
 * as untrusted — every candidate still passes through validateAndNormalizeSql
 * before it reaches the database, regardless of how it was produced.
 */

export type ResponseType = "text" | "table" | "kpi" | "bar" | "line";

export interface GeneratedQuery {
  sql: string;
  type: ResponseType;
  title: string;
  chartLabelKey?: string;
  chartValueKey?: string;
  kpiLabel?: string;
}

export class NoMatchError extends Error {
  constructor() {
    super(
      "I couldn't map that to a supported question. Try asking about: " +
        "total balance by branch, total customers, monthly transaction trend, " +
        "customers by KYC status, or recent transactions."
    );
    this.name = "NoMatchError";
  }
}

interface Intent {
  test: (question: string) => boolean;
  build: () => GeneratedQuery;
}

const intents: Intent[] = [
  {
    test: (q) => /balance/.test(q) && /branch/.test(q),
    build: () => ({
      sql: `
        SELECT b.name AS branch, ROUND(SUM(a.balance), 2) AS total_balance
        FROM accounts a
        JOIN customers c ON c.id = a.customer_id
        JOIN branches b ON b.id = c.branch_id
        WHERE a.status = 'active'
        GROUP BY b.name
        ORDER BY total_balance DESC
      `,
      type: "bar",
      title: "Total Balance by Branch",
      chartLabelKey: "branch",
      chartValueKey: "total_balance",
    }),
  },
  {
    test: (q) => /(total|how many|number of)\s+.*customers?/.test(q) && !/kyc/.test(q),
    build: () => ({
      sql: `SELECT COUNT(*) AS total_customers FROM customers`,
      type: "kpi",
      title: "Total Customers",
      kpiLabel: "Total Customers",
    }),
  },
  {
    test: (q) =>
      /(monthly|month)/.test(q) && /(transaction|txn)/.test(q) && /(trend|over time|by month)/.test(q),
    build: () => ({
      sql: `
        SELECT strftime('%Y-%m', created_at) AS month, COUNT(*) AS transaction_count
        FROM transactions
        GROUP BY month
        ORDER BY month ASC
      `,
      type: "line",
      title: "Monthly Transaction Trend",
      chartLabelKey: "month",
      chartValueKey: "transaction_count",
    }),
  },
  {
    test: (q) => /customers?/.test(q) && /kyc/.test(q),
    build: () => ({
      sql: `
        SELECT kyc_status, COUNT(*) AS customer_count
        FROM customers
        GROUP BY kyc_status
        ORDER BY customer_count DESC
      `,
      type: "bar",
      title: "Customers by KYC Status",
      chartLabelKey: "kyc_status",
      chartValueKey: "customer_count",
    }),
  },
  {
    test: (q) => /recent/.test(q) && /(transaction|txn)/.test(q),
    build: () => ({
      sql: `
        SELECT t.id, t.txn_type, t.amount, t.currency, t.status, t.channel, t.created_at
        FROM transactions t
        ORDER BY t.created_at DESC
        LIMIT 20
      `,
      type: "table",
      title: "Recent Transactions",
    }),
  },
  {
    test: (q) => /average|avg/.test(q) && /balance/.test(q),
    build: () => ({
      sql: `SELECT ROUND(AVG(balance), 2) AS average_balance FROM accounts WHERE status = 'active'`,
      type: "kpi",
      title: "Average Account Balance",
      kpiLabel: "Average Balance (INR)",
    }),
  },
  {
    test: (q) => /(account)/.test(q) && /(type)/.test(q),
    build: () => ({
      sql: `
        SELECT account_type, COUNT(*) AS account_count
        FROM accounts
        GROUP BY account_type
        ORDER BY account_count DESC
      `,
      type: "bar",
      title: "Accounts by Type",
      chartLabelKey: "account_type",
      chartValueKey: "account_count",
    }),
  },
  {
    test: (q) => /(failed|failure)/.test(q) && /(transaction|txn)/.test(q),
    build: () => ({
      sql: `
        SELECT id, txn_type, amount, currency, channel, created_at
        FROM transactions
        WHERE status = 'failed'
        ORDER BY created_at DESC
        LIMIT 20
      `,
      type: "table",
      title: "Failed Transactions",
    }),
  },
  {
    test: (q) => /(channel)/.test(q) && /(transaction|txn)/.test(q),
    build: () => ({
      sql: `
        SELECT channel, COUNT(*) AS transaction_count
        FROM transactions
        GROUP BY channel
        ORDER BY transaction_count DESC
      `,
      type: "bar",
      title: "Transactions by Channel",
      chartLabelKey: "channel",
      chartValueKey: "transaction_count",
    }),
  },
  {
    test: (q) => /(total|sum)/.test(q) && /(transaction|txn)/.test(q) && /(amount|value)/.test(q),
    build: () => ({
      sql: `SELECT ROUND(SUM(amount), 2) AS total_transaction_amount FROM transactions WHERE status = 'completed'`,
      type: "kpi",
      title: "Total Completed Transaction Amount",
      kpiLabel: "Total Amount (INR)",
    }),
  },
];

export async function generateSqlFromQuestion(question: string): Promise<GeneratedQuery> {
  const normalized = question.trim().toLowerCase();
  const intent = intents.find((candidate) => candidate.test(normalized));

  if (!intent) {
    throw new NoMatchError();
  }

  return intent.build();
}
