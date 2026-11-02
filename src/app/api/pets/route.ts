import { asc, eq } from "drizzle-orm";
import { ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { pets } from "@/lib/db/schema";
import { petView } from "@/lib/game/views";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  return withUser(async (profile) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(pets)
      .where(eq(pets.ownerId, profile.id))
      .orderBy(asc(pets.createdAt));

    return ok({ pets: rows.map((pet) => petView(pet)) });
  });
}
