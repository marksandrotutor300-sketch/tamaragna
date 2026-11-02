import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "TamaRagna — Ragnarok monster ranch",
    short_name: "TamaRagna",
    description:
      "A Tamagotchi-inspired monster collector. Hatch Ragnarok mobs, raise them, climb the endless tower and duel other trainers.",
    start_url: "/ranch",
    scope: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#080b11",
    theme_color: "#080b11",
    categories: ["games", "entertainment"],
    shortcuts: [
      {
        name: "Ranch",
        short_name: "Ranch",
        description: "Feed, play with and train your pets",
        url: "/ranch",
      },
      {
        name: "Endless Tower",
        short_name: "Tower",
        description: "Climb the tower with your team",
        url: "/tower",
      },
      {
        name: "Arena",
        short_name: "Arena",
        description: "Duel other trainers",
        url: "/pvp",
      },
    ],
    icons: [
      {
        src: "/icons/icon-192.png",
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/icon-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: "/icons/maskable-512.png",
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
