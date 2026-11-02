import { z } from "zod";
import { getAdminIdentity } from "@/lib/admin";
import { roleFailure, transferOwner } from "@/lib/admin/roles";
import { fail, ok, parseBody } from "@/lib/api";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().email(),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const identity = await getAdminIdentity(request);
  if (!identity) return fail("Not found", 404);

  const parsed = await parseBody(request, schema);
  if ("error" in parsed) return parsed.error;

  try {
    const account = await transferOwner(
      identity,
      parsed.data.email,
      parsed.data.reason ?? "",
    );
    return ok({ account });
  } catch (error) {
    return roleFailure(error);
  }
}
