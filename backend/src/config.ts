import path from "node:path";
import dotenv from "dotenv";

dotenv.config();

export const config = {
  port: Number(process.env.PORT ?? 4000),
  dbPath: path.resolve(process.cwd(), process.env.DB_PATH ?? "./data/bank.db"),
  maxRowLimit: Number(process.env.MAX_ROW_LIMIT ?? 200),
  queryTimeoutMs: Number(process.env.QUERY_TIMEOUT_MS ?? 3000),
};
