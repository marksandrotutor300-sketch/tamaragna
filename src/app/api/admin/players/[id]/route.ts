import { z } from "zod";
import { getAdminIdentity } from "@/lib/admin";
import {
  adminFailure,
  getPlayer,
  recordAdminAction,
  updateWallet,
} from "@/lib/admin/service";
import { fail, ok, parseBody } from "@/lib/api";

export const runtime = "nodejs";

const walletSchema = z
  .object({
    displayName: z.string().trim().min(2).max(20).optional(),
    coins: z.number().int().min(0).max(1_000_000_000).optional(),
    eggs: z.number().int().min(0).max(1000).optional(),
    food: z.number().int().min(0).max(1_000_000).optional(),
    materials: z.number().int().min(0).max(1_000_000).optional(),
    legacyPoints: z.number().int().min(0).max(1_000_000).optional(),
    spectatorPoints: z.number().int().min(0).max(1_000_000).optional(),
  })
  .refine((value) => Object.keys(value).length > 0, {
    message: "Nothing to update",
  });

type Context = { params: Promise<{ id: string }> };

export async function GET(
  request: Request,
  context: Context,
): Promise<Response> {
  const identity = await getAdminIdentity(request);
  if (!identity) return fail("Not found", 404);

  const { id } = await context.params;
  try {
    return ok({ player: await getPlayer(id) });
  } catch (error) {
    return adminFailure(error);
  }
}

export async function PATCH(
  request: Request,
  context: Context,
): Promise<Response> {
  const identity = await getAdminIdentity(request);
  if (!identity) return fail("Not found", 404);

  const parsed = await parseBody(request, walletSchema);
  if ("error" in parsed) return parsed.error;

  const { id } = await context.params;
  try {
    const player = await updateWallet(id, parsed.data);
    await recordAdminAction(identity, "player.wallet", {
      profileId: id,
      detail: parsed.data,
    });
    return ok({ player });
  } catch (error) {
    return adminFailure(error);
  }
}
