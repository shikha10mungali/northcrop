import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { config } from "./config";

fs.mkdirSync(path.dirname(config.dbPath), { recursive: true });

export const db = new Database(config.dbPath);

// Defense in depth: even if the validation layer had a gap, the connection
// itself refuses to execute anything that writes to the database.
db.pragma("query_only = ON");
