import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "./config";

const SCHEMA_SQL = `
CREATE TABLE branches (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT NOT NULL,
  region TEXT NOT NULL
);

CREATE TABLE customers (
  id INTEGER PRIMARY KEY,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  kyc_status TEXT NOT NULL CHECK (kyc_status IN ('pending','verified','rejected')),
  onboarded_at TEXT NOT NULL,
  branch_id INTEGER NOT NULL REFERENCES branches(id)
);

CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  customer_id INTEGER NOT NULL REFERENCES customers(id),
  account_type TEXT NOT NULL CHECK (account_type IN ('savings','current','fixed_deposit')),
  balance REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  opened_at TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('active','dormant','closed'))
);

CREATE TABLE transactions (
  id INTEGER PRIMARY KEY,
  account_id INTEGER NOT NULL REFERENCES accounts(id),
  txn_type TEXT NOT NULL CHECK (txn_type IN ('deposit','withdrawal','transfer','payment')),
  amount REAL NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL CHECK (status IN ('completed','pending','failed')),
  channel TEXT NOT NULL CHECK (channel IN ('mobile','web','branch','atm')),
  created_at TEXT NOT NULL
);

CREATE INDEX idx_accounts_customer ON accounts(customer_id);
CREATE INDEX idx_txn_account ON transactions(account_id);
CREATE INDEX idx_txn_created ON transactions(created_at);
`;

const BRANCHES = [
  { name: "MG Road Branch", city: "Bengaluru", region: "South" },
  { name: "Connaught Place Branch", city: "New Delhi", region: "North" },
  { name: "Andheri Branch", city: "Mumbai", region: "West" },
  { name: "Salt Lake Branch", city: "Kolkata", region: "East" },
  { name: "Anna Nagar Branch", city: "Chennai", region: "South" },
];

const KYC_STATUSES = ["pending", "verified", "rejected"] as const;
const ACCOUNT_TYPES = ["savings", "current", "fixed_deposit"] as const;
const ACCOUNT_STATUSES = ["active", "dormant", "closed"] as const;
const TXN_TYPES = ["deposit", "withdrawal", "transfer", "payment"] as const;
const TXN_STATUSES = ["completed", "pending", "failed"] as const;
const CHANNELS = ["mobile", "web", "branch", "atm"] as const;

const FIRST_NAMES = [
  "Aarav", "Vivaan", "Aditya", "Vihaan", "Arjun", "Sai", "Reyansh", "Krishna",
  "Ishaan", "Rohan", "Ananya", "Diya", "Saanvi", "Aadhya", "Myra", "Anika",
  "Priya", "Neha", "Kavya", "Riya",
];
const LAST_NAMES = [
  "Sharma", "Verma", "Gupta", "Iyer", "Nair", "Reddy", "Patel", "Singh",
  "Mehta", "Kulkarni", "Rao", "Banerjee", "Chatterjee", "Joshi", "Desai",
];

function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function pick<T>(values: readonly T[]): T {
  return values[randomInt(0, values.length - 1)];
}

function randomDateWithinDays(daysAgo: number): string {
  const now = Date.now();
  const past = now - randomInt(0, daysAgo) * 24 * 60 * 60 * 1000;
  return new Date(past).toISOString();
}

function seed(): void {
  fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });
  if (fs.existsSync(config.dbPath)) {
    fs.rmSync(config.dbPath);
  }

  const db = new Database(config.dbPath);
  db.pragma("journal_mode = WAL");
  db.exec(SCHEMA_SQL);

  const insertBranch = db.prepare(
    "INSERT INTO branches (id, name, city, region) VALUES (?, ?, ?, ?)"
  );
  const insertCustomer = db.prepare(
    "INSERT INTO customers (id, full_name, email, kyc_status, onboarded_at, branch_id) VALUES (?, ?, ?, ?, ?, ?)"
  );
  const insertAccount = db.prepare(
    "INSERT INTO accounts (id, customer_id, account_type, balance, currency, opened_at, status) VALUES (?, ?, ?, ?, ?, ?, ?)"
  );
  const insertTxn = db.prepare(
    "INSERT INTO transactions (id, account_id, txn_type, amount, currency, status, channel, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );

  const seedAll = db.transaction(() => {
    BRANCHES.forEach((branch, index) => {
      insertBranch.run(index + 1, branch.name, branch.city, branch.region);
    });

    const customerCount = 120;
    const accountIdsByCustomer: number[][] = [];
    let nextAccountId = 1;

    for (let customerId = 1; customerId <= customerCount; customerId++) {
      const firstName = pick(FIRST_NAMES);
      const lastName = pick(LAST_NAMES);
      const fullName = `${firstName} ${lastName}`;
      const email = `${firstName.toLowerCase()}.${lastName.toLowerCase()}${customerId}@example.com`;
      const branchId = randomInt(1, BRANCHES.length);
      const onboardedAt = randomDateWithinDays(540);

      insertCustomer.run(
        customerId,
        fullName,
        email,
        pick(KYC_STATUSES),
        onboardedAt,
        branchId
      );

      const accountsForCustomer = randomInt(1, 2);
      const ids: number[] = [];
      for (let i = 0; i < accountsForCustomer; i++) {
        const accountId = nextAccountId++;
        insertAccount.run(
          accountId,
          customerId,
          pick(ACCOUNT_TYPES),
          Number(randomInt(500, 500_000).toFixed(2)),
          "INR",
          randomDateWithinDays(500),
          pick(ACCOUNT_STATUSES)
        );
        ids.push(accountId);
      }
      accountIdsByCustomer.push(ids);
    }

    const allAccountIds = accountIdsByCustomer.flat();
    const transactionCount = 3000;

    for (let txnId = 1; txnId <= transactionCount; txnId++) {
      const accountId = pick(allAccountIds);
      insertTxn.run(
        txnId,
        accountId,
        pick(TXN_TYPES),
        Number(randomInt(50, 200_000).toFixed(2)),
        "INR",
        pick(TXN_STATUSES),
        pick(CHANNELS),
        randomDateWithinDays(180)
      );
    }

    return { customerCount, accountCount: allAccountIds.length, transactionCount };
  });

  const summary = seedAll();

  db.close();

  console.log("Seed complete:");
  console.log(`  branches:     ${BRANCHES.length}`);
  console.log(`  customers:    ${summary.customerCount}`);
  console.log(`  accounts:     ${summary.accountCount}`);
  console.log(`  transactions: ${summary.transactionCount}`);
  console.log(`  db path:      ${config.dbPath}`);
}

seed();
