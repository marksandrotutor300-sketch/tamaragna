import { fail } from "@/lib/api";
import { featureUnavailable } from "@/lib/features";
import { getTrainerCard } from "@/lib/game/trainer-cards";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  context: { params: Promise<{ slug: string }> },
): Promise<Response> {
  const disabled = featureUnavailable("share");
  if (disabled) return disabled;

  const { slug } = await context.params;
  const card = await getTrainerCard(slug);
  if (!card) return fail("Trainer card not found", 404);

  return Response.json(card, {
    headers: {
      "Cache-Control": "public, max-age=60, stale-while-revalidate=300",
    },
  });
}
