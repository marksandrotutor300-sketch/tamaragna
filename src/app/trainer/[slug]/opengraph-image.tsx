import { ImageResponse } from "next/og";
import { getTrainerCard } from "@/lib/game/trainer-cards";

export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default async function Image({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const card = await getTrainerCard(slug);
  if (!card) return new Response("Trainer not found", { status: 404 });

  const lead = card.pets[0];

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "linear-gradient(135deg, #080b11 0%, #12201f 55%, #1b2a33 100%)",
          color: "#e8eef7",
          padding: 64,
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 28, color: "#8b9cb3" }}>
          <span>TamaRagna</span>
          <span>trainer card</span>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: 56 }}>
          {lead ? (
            <img
              src={`https://static.divine-pride.net/images/mobs/png/${lead.speciesId}.png`}
              width={280}
              height={280}
              alt=""
              style={{ objectFit: "contain" }}
            />
          ) : null}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <span style={{ fontSize: 64, color: "#ffc94a" }}>{card.displayName}</span>
            <span style={{ fontSize: 32 }}>{card.rating} rating</span>
            <span style={{ fontSize: 28, color: "#8b9cb3" }}>Season {card.season}</span>
          </div>
        </div>

        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 26, color: "#8b9cb3" }}>
          <span>{card.pets.map((pet) => pet.nickname).join(" · ") || "No pets yet"}</span>
          <span style={{ color: "#3ad7c0" }}>tamaragna</span>
        </div>
      </div>
    ),
    size,
  );
}
