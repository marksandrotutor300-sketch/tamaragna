import { z } from "zod";
import { getAdminIdentity } from "@/lib/admin";
import { adminFailure, recordAdminAction, transferPet } from "@/lib/admin/service";
import { fail, ok, parseBody } from "@/lib/api";

export const runtime = "nodejs";

const schema = z.object({
  toProfileId: z.string().uuid(),
});

type Context = { params: Promise<{ id: string }> };

export async function POST(
  request: Request,
  context: Context,
): Promise<Response> {
  const identity = await getAdminIdentity(request);
  if (!identity) return fail("Not found", 404);

  const parsed = await parseBody(request, schema);
  if ("error" in parsed) return parsed.error;

  const { id } = await context.params;
  try {
    const pet = await transferPet(id, parsed.data.toProfileId);
    await recordAdminAction(identity, "pet.transfer", {
      petId: id,
      profileId: parsed.data.toProfileId,
    });
    return ok({ pet });
  } catch (error) {
    return adminFailure(error);
  }
}
