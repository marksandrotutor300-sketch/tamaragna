import { desc, eq } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { marketListings, pets, profiles } from "@/lib/db/schema";
import { petView } from "@/lib/game/views";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

const listSchema = z.object({
  petId: z.string().uuid(),
  price: z.number().int().min(100).max(1_000_000),
});

export async function GET(): Promise<Response> {
  const db = await getDb();
  const rows = await db
    .select({ listing: marketListings, pet: pets, seller: profiles })
    .from(marketListings)
    .innerJoin(pets, eq(marketListings.petId, pets.id))
    .innerJoin(profiles, eq(marketListings.sellerId, profiles.id))
    .where(eq(marketListings.status, "active"))
    .orderBy(desc(marketListings.createdAt))
    .limit(50);

  return ok({
    listings: rows.map(({ listing, pet, seller }) => ({
      id: listing.id,
      price: listing.price,
      seller: seller.displayName,
      sellerId: listing.sellerId,
      createdAt: listing.createdAt,
      pet: petView(pet),
    })),
  });
}

export async function POST(request: Request): Promise<Response> {
  return withUser(async (profile) => {
    if (!(await checkRateLimit(`${profile.id}:market-list`, LIMITS.marketList))) {
      return fail("Too many market actions - wait a few minutes", 429);
    }
    const parsed = await parseBody(request, listSchema);
    if ("error" in parsed) return parsed.error;

    const db = await getDb();
    const rows = await db
      .select()
      .from(pets)
      .where(eq(pets.id, parsed.data.petId))
      .limit(1);
    const pet = rows[0];
    if (!pet || pet.ownerId !== profile.id) return fail("Pet not found", 404);
    if (pet.slot !== null) return fail("Move the pet to storage before listing it", 400);
    if (pet.marketListed) return fail("This pet is already listed", 409);
    if (pet.expeditionId) return fail("This pet is on an expedition", 400);

    const listing = await db.transaction(async (tx) => {
      const inserted = await tx
        .insert(marketListings)
        .values({
          sellerId: profile.id,
          petId: pet.id,
          price: parsed.data.price,
        })
        .returning();
      await tx
        .update(pets)
        .set({ marketListed: true })
        .where(eq(pets.id, pet.id));
      return inserted[0];
    });

    return ok({ listing });
  });
}
