import { getDb } from "../src/lib/db/client";
import {
  MIGRATIONS,
  getAppliedMigrations,
  getSchemaVersion,
} from "../src/lib/db/migrations";

async function main(): Promise<void> {
  const db = await getDb();
  const [version, applied] = await Promise.all([
    getSchemaVersion(db),
    getAppliedMigrations(db),
  ]);
  const appliedSet = new Set(applied);

  console.log(`schema ${version}`);
  for (const migration of MIGRATIONS) {
    const state = appliedSet.has(migration.version) ? "applied" : "pending";
    console.log(`${state.padEnd(8)} ${migration.version}  ${migration.name}`);
  }

  process.exit(0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
