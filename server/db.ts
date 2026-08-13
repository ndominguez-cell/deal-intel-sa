import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@shared/schema";

export type Db = ReturnType<typeof drizzle<typeof schema>>;

let _db: Db | undefined;

// Lazily create the connection so importing this module never throws.
// Callers only reach this when DATABASE_URL is configured (see storage.ts).
export function getDb(): Db {
  if (!_db) {
    if (!process.env.DATABASE_URL) {
      throw new Error("DATABASE_URL must be set.");
    }
    const pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
    });
    _db = drizzle(pool, { schema });
  }
  return _db;
}
