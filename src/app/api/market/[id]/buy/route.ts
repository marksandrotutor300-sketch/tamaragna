import { and, eq } from "drizzle-orm";
import { fail, ok, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { marketListings, pets, profiles } from "@/lib/db/schema";
import { refreshPvpSnapshot } from "@/lib/game/pvp-service";
import { petView } from "@/lib/game/views";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

const MAX_PETS = 30;
const FEE_RATE = 0.05;

export async function POST(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await context.params;
  return withUser(async (buyer) => {
    if (!(await checkRateLimit(`${buyer.id}:market-buy`, LIMITS.marketBuy))) {
      return fail("Too many market actions - wait a few minutes", 429);
    }

    const db = await getDb();
    const rows = await db
      .select({ listing: marketListings, pet: pets, seller: profiles })
      .from(marketListings)
      .innerJoin(pets, eq(marketListings.petId, pets.id))
      .innerJoin(profiles, eq(marketListings.sellerId, profiles.id))
      .where(eq(marketListings.id, id))
      .limit(1);
    const row = rows[0];
    if (!row) return fail("Listing not found", 404);
    if (row.listing.status !== "active") return fail("Listing is no longer active", 409);
    if (row.listing.sellerId === buyer.id) return fail("You cannot buy your own pet", 400);
    if (row.pet.ownerId !== row.listing.sellerId || !row.pet.marketListed) {
      return fail("Listing is inconsistent - ask the seller to relist", 409);
    }
    if (buyer.coins < row.listing.price) return fail("Not enough coins", 400);

    const owned = await db
      .select({ id: pets.id })
      .from(pets)
      .where(eq(pets.ownerId, buyer.id));
    if (owned.length >= MAX_PETS) return fail(`Ranch is full (${MAX_PETS} pets)`, 400);

    const fee = Math.floor(row.listing.price * FEE_RATE);
    const sellerCoins = row.seller.coins + row.listing.price - fee;

    const result = await db.transaction(async (tx) => {
      const [boughtPet] = await tx
        .update(pets)
        .set({
          ownerId: buyer.id,
          slot: null,
          marketListed: false,
          expeditionId: null,
        })
        .where(and(eq(pets.id, row.pet.id), eq(pets.ownerId, row.seller.id)))
        .returning();

      await tx
        .update(marketListings)
        .set({
          status: "sold",
          buyerId: buyer.id,
          fee,
          soldAt: new Date(),
        })
        .where(eq(marketListings.id, row.listing.id));

      const [buyerProfile] = await tx
        .update(profiles)
        .set({ coins: buyer.coins - row.listing.price })
        .where(eq(profiles.id, buyer.id))
        .returning();
      await tx
        .update(profiles)
        .set({ coins: sellerCoins })
        .where(eq(profiles.id, row.seller.id));

      return { pet: boughtPet, buyer: buyerProfile };
    });

    await refreshPvpSnapshot(result.buyer ?? buyer);
    await refreshPvpSnapshot(row.seller);

    return ok({
      pet: petView(result.pet),
      coins: result.buyer?.coins ?? buyer.coins - row.listing.price,
      fee,
    });
  });
}
