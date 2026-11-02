import { and, eq } from "drizzle-orm";
import { z } from "zod";
import { superAdminGuard } from "@/lib/admin";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { pets, profiles } from "@/lib/db/schema";
import { petView } from "@/lib/game/views";

export const runtime = "nodejs";

const schema = z.object({
  petId: z.string().uuid(),
  level: z.number().int().min(1).max(50).optional(),
  star: z.number().int().min(1).max(5).optional(),
  coins: z.number().int().min(0).max(1_000_000_000).optional(),
  speciesId: z.number().int().positive().optional(),
  eggs: z.number().int().min(0).max(1000).optional(),
  materials: z.number().int().min(0).max(1_000_000).optional(),
  legacyPoints: z.number().int().min(0).max(1_000_000).optional(),
});

/**
 * Development-only seed helper for evolution/live verification. It requires
 * ADMIN_TOKEN; disable the admin token in production.
 */
export async function POST(request: Request): Promise<Response> {
  const guard = await superAdminGuard(request);
  if (guard) return guard;

  return withUser(async (profile) => {
    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;

    const db = await getDb();
    const rows = await db
      .select()
      .from(pets)
      .where(
        and(eq(pets.id, parsed.data.petId), eq(pets.ownerId, profile.id)),
      )
      .limit(1);
    const pet = rows[0];
    if (!pet) return fail("Pet not found", 404);

    const updated = await db
      .update(pets)
      .set({
        level: parsed.data.level ?? pet.level,
        star: parsed.data.star ?? pet.star,
        speciesId: parsed.data.speciesId ?? pet.speciesId,
      })
      .where(eq(pets.id, pet.id))
      .returning();

    if (
      parsed.data.coins !== undefined ||
      parsed.data.eggs !== undefined ||
      parsed.data.materials !== undefined ||
      parsed.data.legacyPoints !== undefined
    ) {
      await db
        .update(profiles)
        .set({
          ...(parsed.data.coins !== undefined ? { coins: parsed.data.coins } : {}),
          ...(parsed.data.eggs !== undefined ? { eggs: parsed.data.eggs } : {}),
          ...(parsed.data.materials !== undefined
            ? { materials: parsed.data.materials }
            : {}),
          ...(parsed.data.legacyPoints !== undefined
            ? { legacyPoints: parsed.data.legacyPoints }
            : {}),
        })
        .where(eq(profiles.id, profile.id));
    }

    return ok({ pet: petView(updated[0]) });
  });
}
