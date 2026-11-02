import { and, eq, ne } from "drizzle-orm";
import { z } from "zod";
import { fail, ok, parseBody, withUser } from "@/lib/api";
import { getDb } from "@/lib/db/client";
import { profiles } from "@/lib/db/schema";
import { featureUnavailable } from "@/lib/features";
import {
  isValidPublicSlug,
  normalizePublicSlug,
} from "@/lib/game/share";
import { checkRateLimit, LIMITS } from "@/lib/rate-limit";

export const runtime = "nodejs";

const schema = z.object({
  publicCard: z.boolean(),
  slug: z.string().trim().max(24).optional(),
});

export async function PATCH(request: Request): Promise<Response> {
  const disabled = featureUnavailable("share");
  if (disabled) return disabled;

  return withUser(async (profile) => {
    if (
      !(await checkRateLimit(
        `${profile.id}:public-card`,
        LIMITS.publicCard,
      ))
    ) {
      return fail("Too many changes - wait a minute", 429);
    }

    const parsed = await parseBody(request, schema);
    if ("error" in parsed) return parsed.error;

    const candidate =
      parsed.data.slug ??
      profile.publicSlug ??
      profile.displayName;
    const slug = normalizePublicSlug(candidate);

    if (parsed.data.publicCard && !isValidPublicSlug(slug)) {
      return fail(
        "Pick a 3-24 character slug using letters, numbers and hyphens",
        400,
      );
    }

    const db = await getDb();
    if (parsed.data.publicCard) {
      const conflict = await db
        .select({ id: profiles.id })
        .from(profiles)
        .where(
          and(
            eq(profiles.publicSlug, slug),
            ne(profiles.id, profile.id),
          ),
        )
        .limit(1);
      if (conflict[0]) return fail("That trainer slug is already taken", 409);
    }

    const updated = await db
      .update(profiles)
      .set({
        publicCard: parsed.data.publicCard,
        publicSlug: parsed.data.publicCard ? slug : profile.publicSlug ?? slug,
      })
      .where(eq(profiles.id, profile.id))
      .returning();

    const current = updated[0] ?? profile;
    return ok({
      publicCard: current.publicCard,
      slug: current.publicSlug,
    });
  });
}
