import { z } from "zod";
import { getAdminIdentity } from "@/lib/admin";
import {
  adminFailure,
  createPetForPlayer,
  isNatureId,
  recordAdminAction,
} from "@/lib/admin/service";
import { fail, ok, parseBody } from "@/lib/api";
import type { NatureId } from "@/lib/game/nature";
import type { Rarity } from "@/lib/game/types";

export const runtime = "nodejs";

const ivsSchema = z.object({
  str: z.number().int().min(0).max(31),
  agi: z.number().int().min(0).max(31),
  vit: z.number().int().min(0).max(31),
  int: z.number().int().min(0).max(31),
  dex: z.number().int().min(0).max(31),
  luk: z.number().int().min(0).max(31),
});

const overridesSchema = z
  .object({
    hpMax: z.number().min(1).max(10_000_000),
    atk: z.number().min(0).max(10_000_000),
    matk: z.number().min(0).max(10_000_000),
    def: z.number().min(0).max(10_000_000),
    mdef: z.number().min(0).max(10_000_000),
    aspdMs: z.number().min(350).max(2400),
    critChance: z.number().min(0).max(1),
    critMult: z.number().min(1).max(10),
    statusResist: z.number().min(0).max(1),
  })
  .partial();

const createSchema = z.object({
  profileId: z.string().uuid(),
  mode: z.enum(["custom", "random"]).default("custom"),
  speciesId: z.number().int().positive().optional(),
  nickname: z.string().trim().min(1).max(20).optional(),
  rarity: z.number().int().min(1).max(5).optional(),
  nature: z.string().refine(isNatureId, "Unknown nature").optional(),
  level: z.number().int().min(1).max(50).optional(),
  exp: z.number().int().min(0).max(1_000_000_000).optional(),
  star: z.number().int().min(1).max(5).optional(),
  ivs: ivsSchema.optional(),
  loadout: z.array(z.number().int()).length(4).optional(),
  statOverrides: overridesSchema.optional(),
});

export async function POST(request: Request): Promise<Response> {
  const identity = await getAdminIdentity(request);
  if (!identity) return fail("Not found", 404);

  const parsed = await parseBody(request, createSchema);
  if ("error" in parsed) return parsed.error;

  try {
    const pet = await createPetForPlayer({
      ...parsed.data,
      rarity: parsed.data.rarity as Rarity | undefined,
      nature: parsed.data.nature as NatureId | undefined,
    });
    await recordAdminAction(identity, "pet.create", {
      profileId: parsed.data.profileId,
      petId: pet.id,
      detail: {
        mode: parsed.data.mode,
        speciesId: pet.speciesId,
        rarity: pet.rarity,
        level: pet.level,
      },
    });
    return ok({ pet }, 201);
  } catch (error) {
    return adminFailure(error);
  }
}
