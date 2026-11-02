import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { featureUnavailable } from "@/lib/features";
import { applyLiveInput } from "@/lib/live/rooms";
import { verifyLiveTicket } from "@/lib/live/ticket";

export const runtime = "nodejs";

const schema = z.object({
  ticket: z.string().min(1).max(2048),
  kind: z.enum(["skill", "swap"]),
  index: z.number().int().min(0).max(3),
});

export async function POST(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const disabled = featureUnavailable("livePvp");
  if (disabled) return disabled;

  const { id } = await context.params;
  const parsed = await parseBody(request, schema);
  if ("error" in parsed) return parsed.error;

  const ticket = verifyLiveTicket(parsed.data.ticket);
  if (!ticket || ticket.matchId !== id) {
    return fail("Invalid match ticket", 403);
  }
  if (parsed.data.kind === "swap" && parsed.data.index > 2) {
    return fail("Invalid swap slot", 400);
  }

  const applied = applyLiveInput(id, ticket, {
    kind: parsed.data.kind,
    index: parsed.data.index,
  });
  if (!applied) return fail("Match is not accepting inputs", 409);

  return ok({ applied: true });
}
