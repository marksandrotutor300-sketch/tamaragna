import { sql } from "drizzle-orm";
import { getDb } from "../src/lib/db/client";

async function main(): Promise<void> {
  const db = await getDb();
  const result = await db.execute(
    sql`DELETE FROM analytics_events WHERE created_at < now() - interval '90 days'`,
  );
  console.log("Pruned raw analytics older than 90 days", result);
  process.exit(0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
