import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import * as schema from "./schema";

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error("DATABASE_URL is not set");
}

declare global {
  var __bananaflowPool: Pool | undefined;
}

// Cached on globalThis in development so Next.js hot reloads reuse one pool.
const pool =
  globalThis.__bananaflowPool ??
  new Pool({
    connectionString: databaseUrl,
    max: 10,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
  });

if (process.env.NODE_ENV !== "production") {
  globalThis.__bananaflowPool = pool;
}

export const db = drizzle({ client: pool, schema, casing: "camelCase" });
