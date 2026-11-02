import { z } from "zod";
import { getAdminIdentity } from "@/lib/admin";
import {
  adminFailure,
  isNatureId,
  recordAdminAction,
  updatePetAsAdmin,
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

const patchSchema = z.object({
  nickname: z.string().trim().min(1).max(20).optional(),
  level: z.number().int().min(1).max(50).optional(),
  exp: z.number().int().min(0).max(1_000_000_000).optional(),
  rarity: z.number().int().min(1).max(5).optional(),
  nature: z.string().refine(isNatureId, "Unknown nature").optional(),
  star: z.number().int().min(1).max(5).optional(),
  evolutionStage: z.number().int().min(1).max(6).optional(),
  ivs: ivsSchema.optional(),
  loadout: z.array(z.number().int()).length(4).optional(),
  statOverrides: overridesSchema.nullable().optional(),
});

type Context = { params: Promise<{ id: string }> };

export async function PATCH(
  request: Request,
  context: Context,
): Promise<Response> {
  const identity = await getAdminIdentity(request);
  if (!identity) return fail("Not found", 404);

  const parsed = await parseBody(request, patchSchema);
  if ("error" in parsed) return parsed.error;

  const { id } = await context.params;
  try {
    const pet = await updatePetAsAdmin(id, {
      ...parsed.data,
      rarity: parsed.data.rarity as Rarity | undefined,
      nature: parsed.data.nature as NatureId | undefined,
    });
    await recordAdminAction(identity, "pet.update", {
      petId: id,
      detail: { fields: Object.keys(parsed.data) },
    });
    return ok({ pet });
  } catch (error) {
    return adminFailure(error);
  }
}
