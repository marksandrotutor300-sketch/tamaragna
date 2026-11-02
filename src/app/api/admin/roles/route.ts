import { z } from "zod";
import { getAdminIdentity } from "@/lib/admin";
import {
  grantAdmin,
  listAccounts,
  listRoleEvents,
  roleFailure,
  searchAccounts,
} from "@/lib/admin/roles";
import { fail, ok, parseBody } from "@/lib/api";

export const runtime = "nodejs";

export async function GET(request: Request): Promise<Response> {
  const identity = await getAdminIdentity(request);
  if (!identity) return fail("Not found", 404);

  const query = new URL(request.url).searchParams.get("q") ?? "";
  try {
    return ok({
      role: identity.role,
      accounts: query ? await searchAccounts(identity, query) : await listAccounts(identity),
      events: await listRoleEvents(identity),
    });
  } catch (error) {
    return roleFailure(error);
  }
}

const grantSchema = z.object({
  email: z.string().trim().email(),
  reason: z.string().trim().max(500).optional(),
});

export async function POST(request: Request): Promise<Response> {
  const identity = await getAdminIdentity(request);
  if (!identity) return fail("Not found", 404);

  const parsed = await parseBody(request, grantSchema);
  if ("error" in parsed) return parsed.error;

  try {
    const account = await grantAdmin(identity, parsed.data.email, parsed.data.reason ?? "");
    return ok({ account });
  } catch (error) {
    return roleFailure(error);
  }
}
