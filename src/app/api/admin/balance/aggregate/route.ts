import { superAdminGuard } from "@/lib/admin";
import { fail, ok } from "@/lib/api";
import { recomputeBalance } from "@/lib/game/balance";

export const runtime = "nodejs";

export async function POST(request: Request): Promise<Response> {
  const guard = await superAdminGuard(request);
  if (guard) return guard;
  try {
    return ok(await recomputeBalance());
  } catch (error) {
    return fail(
      error instanceof Error ? error.message : "Could not aggregate balance",
      500,
    );
  }
}
