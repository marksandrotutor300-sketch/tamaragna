import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db/client";
import { users } from "../src/lib/db/schema";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const revoke = args.includes("--revoke");
  const email = args
    .find((arg) => !arg.startsWith("--"))
    ?.trim()
    .toLowerCase();

  if (!email) {
    console.error("Usage: npm run admin:promote -- <email> [--revoke]");
    process.exit(1);
  }

  const db = await getDb();
  const rows = await db
    .update(users)
    .set({ isSuperAdmin: !revoke })
    .where(eq(users.email, email))
    .returning({ id: users.id, email: users.email });

  if (!rows[0]) {
    console.error(
      `No account for ${email}. Sign in with a magic link once, then run this again.`,
    );
    process.exit(1);
  }

  console.log(`${revoke ? "Revoked" : "Granted"} super admin for ${rows[0].email}`);
  process.exit(0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
