import { eq } from "drizzle-orm";
import { getDb } from "../src/lib/db/client";
import { users } from "../src/lib/db/schema";

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const revoke = args.includes("--revoke");
  const owner = args.includes("--owner");
  const email = args
    .find((arg) => !arg.startsWith("--"))
    ?.trim()
    .toLowerCase();

  if (!email) {
    console.error("Usage: npm run admin:promote -- <email> [--owner] [--revoke]");
    process.exit(1);
  }

  const db = await getDb();
  const existing = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  if (!existing[0]) {
    console.error(
      `No account for ${email}. Sign in with a magic link once, then run this again.`,
    );
    process.exit(1);
  }

  if (owner && !revoke) {
    await db
      .update(users)
      .set({ adminRole: "admin", isSuperAdmin: true })
      .where(eq(users.adminRole, "owner"));
  }

  const rows = await db
    .update(users)
    .set({
      isSuperAdmin: !revoke,
      adminRole: revoke ? null : owner ? "owner" : "admin",
    })
    .where(eq(users.email, email))
    .returning({ id: users.id, email: users.email });

  if (!rows[0]) {
    console.error(
      `No account for ${email}. Sign in with a magic link once, then run this again.`,
    );
    process.exit(1);
  }

  console.log(
    `${revoke ? "Revoked" : owner ? "Granted owner" : "Granted admin"} for ${rows[0].email}`,
  );
  process.exit(0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
