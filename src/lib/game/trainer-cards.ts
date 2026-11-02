import { and, count, desc, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { pets, profiles, ranchVisits } from "@/lib/db/schema";
import { getHabitat, type Habitat } from "./habitats";
import { petView } from "./views";
import { isValidPublicSlug } from "./share";

export type TrainerCardPet = {
  speciesId: number;
  nickname: string;
  level: number;
  rarity: number;
  nature: string;
  star: number;
  power: number;
};

export type TrainerCard = {
  slug: string;
  displayName: string;
  rating: number;
  season: number;
  habitat: Habitat;
  visits: number;
  pets: TrainerCardPet[];
};

export async function getTrainerCard(
  slug: string,
): Promise<TrainerCard | null> {
  if (!isValidPublicSlug(slug)) return null;

  const db = await getDb();
  const rows = await db
    .select()
    .from(profiles)
    .where(and(eq(profiles.publicSlug, slug), eq(profiles.publicCard, true)))
    .limit(1);

  const profile = rows[0];
  if (!profile) return null;

  const petRows = await db
    .select()
    .from(pets)
    .where(eq(pets.ownerId, profile.id))
    .orderBy(desc(pets.level), desc(pets.star))
    .limit(3);

  const visitRows = await db
    .select({ value: count() })
    .from(ranchVisits)
    .where(eq(ranchVisits.hostId, profile.id));

  return {
    slug,
    displayName: profile.displayName,
    rating: profile.rating,
    season: profile.season,
    habitat: getHabitat(profile.habitat),
    visits: Number(visitRows[0]?.value ?? 0),
    pets: petRows.map((pet) => {
      const view = petView(pet);
      return {
        speciesId: pet.speciesId,
        nickname: pet.nickname,
        level: pet.level,
        rarity: pet.rarity,
        nature: pet.nature,
        star: pet.star,
        power: view.power,
      };
    }),
  };
}

export async function getTrainerSlugs(): Promise<string[]> {
  const db = await getDb();
  const rows = await db
    .select({ slug: profiles.publicSlug })
    .from(profiles)
    .where(and(eq(profiles.publicCard, true)));
  return rows.flatMap((row) => (row.slug ? [row.slug] : []));
}
