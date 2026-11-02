import { fail, ok } from "@/lib/api";
import { featureUnavailable } from "@/lib/features";
import { getTournamentDetail } from "@/lib/tournaments";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const disabled = featureUnavailable("livePvp");
  if (disabled) return disabled;

  const { id } = await context.params;
  const detail = await getTournamentDetail(id);
  if (!detail) return fail("Tournament not found", 404);
  return ok(detail);
}
