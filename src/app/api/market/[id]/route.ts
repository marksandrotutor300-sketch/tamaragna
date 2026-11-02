import { and, eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { marketListings, pets } from "@/lib/db/schema";

export const runtime = "nodejs";

export async function DELETE(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return withUser(async (profile) => {
    const db = await getDb();
    const rows = await db
      .select()
      .from(marketListings)
      .where(eq(marketListings.id, id))
      .limit(1);
    const listing = rows[0];
    if (!listing) return fail("Listing not found", 404);
    if (listing.sellerId !== profile.id) return fail("Not your listing", 403);
    if (listing.status !== "active") return fail("Listing is no longer active", 400);

    await db.transaction(async (tx) => {
      await tx
        .update(marketListings)
        .set({ status: "cancelled" })
        .where(eq(marketListings.id, listing.id));
      await tx
        .update(pets)
        .set({ marketListed: false })
        .where(and(eq(pets.id, listing.petId), eq(pets.ownerId, profile.id)));
    });

    return ok({ cancelled: true });
  });
}
