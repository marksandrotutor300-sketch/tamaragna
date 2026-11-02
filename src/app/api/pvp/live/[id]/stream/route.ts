import { featureUnavailable } from "@/lib/features";
import { subscribeLiveRoom } from "@/lib/live/rooms";
import { verifyLiveTicket } from "@/lib/live/ticket";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
): Promise<Response> {
  const disabled = featureUnavailable("livePvp");
  if (disabled) return disabled;

  const { id } = await context.params;
  const token = new URL(request.url).searchParams.get("ticket") ?? "";
  const ticket = verifyLiveTicket(token);
  if (!ticket || ticket.matchId !== id) {
    return new Response("Invalid ticket", { status: 403 });
  }

  const encoder = new TextEncoder();
  let cleanup: (() => void) | null = null;
  let heartbeat: ReturnType<typeof setInterval> | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (snapshot: unknown) => {
        try {
          controller.enqueue(
            encoder.encode(`data: ${JSON.stringify(snapshot)}\n\n`),
          );
        } catch {
          // Client disconnected.
        }
      };

      cleanup = subscribeLiveRoom(id, ticket, send);
      if (!cleanup) {
        controller.enqueue(encoder.encode("event: error\ndata: room not found\n\n"));
        controller.close();
        return;
      }

      heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(": ping\n\n"));
        } catch {
          // Ignore closed streams.
        }
      }, 15_000);

      request.signal.addEventListener("abort", () => {
        cleanup?.();
        if (heartbeat) clearInterval(heartbeat);
      });
    },
    cancel() {
      cleanup?.();
      if (heartbeat) clearInterval(heartbeat);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
