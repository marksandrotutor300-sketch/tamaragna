import { PGlite } from "@electric-sql/pglite";
import { drizzle as drizzlePglite } from "drizzle-orm/pglite";
import type { PgDatabase } from "drizzle-orm/pg-core";
import { drizzle as drizzlePostgres } from "drizzle-orm/postgres-js";
import { mkdir } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import postgres from "postgres";
import { DDL } from "./ddl";
import { runMigrations } from "./migrations";
import * as schema from "./schema";

export type Db = PgDatabase<any, typeof schema>;

type DbHolder = { promise: Promise<Db> | null };

const holder: DbHolder = ((globalThis as { __tamaragnaDb?: DbHolder }).__tamaragnaDb ??= {
  promise: null,
});

async function bootstrapPostgres(url: string): Promise<Db> {
  const requested = Number(process.env.POSTGRES_MAX ?? (process.env.VERCEL ? 1 : 5));
  const max = Number.isFinite(requested) ? Math.max(1, requested) : 1;
  // Supabase's shared pooler is safest with prepared statements off for
  // transaction-mode compatibility. Session mode (recommended for the Render
  // backend) also accepts this setting.
  const client = postgres(url, { max, prepare: false });
  const db = drizzlePostgres(client, { schema });

  for (const statement of DDL.split(";")) {
    const trimmed = statement.trim();
    if (trimmed.length > 0) await client.unsafe(trimmed);
  }

  return db as unknown as Db;
}

async function bootstrapPglite(): Promise<Db> {
  // Kept outside the project so the dev file watcher never sees database writes.
  const dataDir =
    process.env.PGLITE_DIR ?? path.join(os.homedir(), ".tamaragna", "pglite");
  await mkdir(dataDir, { recursive: true });
  const client = new PGlite(dataDir);
  await client.waitReady;
  await client.exec(DDL);
  return drizzlePglite(client, { schema }) as unknown as Db;
}

export async function getDb(): Promise<Db> {
  if (!holder.promise) {
    holder.promise = (async () => {
      const db = process.env.DATABASE_URL
        ? await bootstrapPostgres(process.env.DATABASE_URL)
        : await bootstrapPglite();
      await runMigrations(db);
      return db;
    })();
  }
  return holder.promise;
}
