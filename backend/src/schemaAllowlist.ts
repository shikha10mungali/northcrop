/**
 * Single source of truth for what the validation layer considers queryable.
 * Both the SQL validator and the seed script derive from this list, so a
 * table can never become reachable by AI-generated SQL without an explicit,
 * reviewed addition here.
 */
export const ALLOWED_TABLES: Record<string, string[]> = {
  branches: ["id", "name", "city", "region"],
  customers: [
    "id",
    "full_name",
    "email",
    "kyc_status",
    "onboarded_at",
    "branch_id",
  ],
  accounts: [
    "id",
    "customer_id",
    "account_type",
    "balance",
    "currency",
    "opened_at",
    "status",
  ],
  transactions: [
    "id",
    "account_id",
    "txn_type",
    "amount",
    "currency",
    "status",
    "channel",
    "created_at",
  ],
};

export const ALLOWED_TABLE_NAMES = Object.keys(ALLOWED_TABLES);
