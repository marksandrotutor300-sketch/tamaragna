import { z } from "zod";
import { getAdminIdentity } from "@/lib/admin";
import { roleFailure, rollbackRole } from "@/lib/admin/roles";
import { fail, ok, parseBody } from "@/lib/api";

export const runtime = "nodejs";

const schema = z.object({
  reason: z.string().trim().max(500).optional(),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ userId: string }> },
): Promise<Response> {
  const identity = await getAdminIdentity(request);
  if (!identity) return fail("Not found", 404);

  const parsed = await parseBody(request, schema);
  if ("error" in parsed) return parsed.error;

  const { userId } = await context.params;
  try {
    const account = await rollbackRole(identity, userId, parsed.data.reason ?? "");
    return ok({ account });
  } catch (error) {
    return roleFailure(error);
  }
}
