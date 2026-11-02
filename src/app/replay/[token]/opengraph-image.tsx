import { ImageResponse } from "next/og";
import { getReplayByToken } from "@/lib/game/replays";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const replay = await getReplayByToken(token);
  if (!replay) return new Response("Replay not found", { status: 404 });

  const a = replay.payload.teamA[0];
  const b = replay.payload.teamB[0];
  const winner =
    replay.result.winner === "a"
      ? a?.name ?? "Team A"
      : replay.result.winner === "b"
        ? b?.name ?? "Team B"
        : "Draw";

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #080b11 0%, #101827 60%, #1d2b33 100%)",
          color: "#e8eef7",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: "#8b9cb3" }}>
          <span>TamaRagna</span>
          <span>shared replay</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 32 }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 360 }}>
            <img
              src={`https://static.divine-pride.net/images/mobs/png/${a?.speciesId ?? 1002}.png`}
              width={240}
              height={240}
              alt=""
              style={{ objectFit: "contain" }}
            />
            <span style={{ fontSize: 32 }}>{a?.name ?? "Team A"}</span>
          </div>

          <div style={{ fontSize: 48, color: "#ffc94a" }}>vs</div>

          <div style={{ display: "flex", flexDirection: "column", alignItems: "center", width: 360 }}>
            <img
              src={`https://static.divine-pride.net/images/mobs/png/${b?.speciesId ?? 1002}.png`}
              width={240}
              height={240}
              alt=""
              style={{ objectFit: "contain" }}
            />
            <span style={{ fontSize: 32 }}>{b?.name ?? "Team B"}</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28 }}>
          <span style={{ color: "#3ad7c0" }}>{winner} wins</span>
          <span style={{ color: "#8b9cb3" }}>
            {(replay.result.durationMs / 1000).toFixed(1)}s · {replay.sharedBy}
          </span>
        </div>
      </div>
    ),
    size,
  );
}
