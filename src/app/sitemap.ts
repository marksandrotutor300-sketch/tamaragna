import type { MetadataRoute } from "next";
import { ALL_SUMMARIES } from "@/lib/game/species";
import { getTrainerSlugs } from "@/lib/game/trainer-cards";
import { siteUrl } from "@/lib/site";

export const dynamic = "force-dynamic";

const STATIC_PATHS = [
  "/",
  "/bestiary",
  "/ranch",
  "/team",
  "/breed",
  "/hatch",
  "/quests",
  "/pvp",
  "/tower",
  "/cards",
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = siteUrl();
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = STATIC_PATHS.map((path) => ({
    url: `${base}${path}`,
    lastModified: now,
    changeFrequency: path === "/" ? "weekly" : "monthly",
    priority: path === "/" ? 1 : path === "/bestiary" ? 0.9 : 0.6,
  }));

  const speciesEntries: MetadataRoute.Sitemap = ALL_SUMMARIES.map((species) => ({
    url: `${base}/bestiary/${species.id}`,
    lastModified: now,
    changeFrequency: "monthly",
    priority: 0.7,
  }));

  let trainerEntries: MetadataRoute.Sitemap = [];
  try {
    const slugs = await getTrainerSlugs();
    trainerEntries = slugs.map((slug) => ({
      url: `${base}/trainer/${slug}`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 0.5,
    }));
  } catch {
    // Sitemap generation must not fail if the database is unavailable.
  }

  return [...staticEntries, ...speciesEntries, ...trainerEntries];
}
