import { getAdminIdentity } from "@/lib/admin";
import { adminFailure, listAudit } from "@/lib/admin/service";
import { fail, ok } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const identity = await getAdminIdentity(request);
  if (!identity) return fail("Not found", 404);

  try {
    return ok({ entries: await listAudit(50) });
  } catch (error) {
    return adminFailure(error);
  }
}
