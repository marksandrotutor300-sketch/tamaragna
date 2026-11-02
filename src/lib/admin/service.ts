import { and, asc, desc, eq, ilike, or, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  adminAuditLog,
  marketListings,
  pets,
  profiles,
  type Profile,
} from "@/lib/db/schema";
import type { AdminIdentity } from "@/lib/admin";
import { defaultCare } from "@/lib/game/care";
import { rollHatch } from "@/lib/game/hatch";
import { getPetMasteryMap } from "@/lib/game/mastery";
import { NATURE_IDS, type NatureId } from "@/lib/game/nature";
import { refreshPvpSnapshot } from "@/lib/game/pvp-service";
import { normalizeLoadout } from "@/lib/game/skills";
import { getSpecies, requireSpecies } from "@/lib/game/species";
import { STAT_OVERRIDE_KEYS, type StatOverrides } from "@/lib/game/stats";
import type { Ivs, Rarity } from "@/lib/game/types";
import { petView } from "@/lib/game/views";
import { logEvent } from "@/lib/log";
import { Rng } from "@/lib/rng";

export const MAX_PETS = 30;

export class AdminError extends Error {
  status: number;

  constructor(message: string, status = 400) {
    super(message);
    this.name = "AdminError";
    this.status = status;
  }
}

export function adminFailure(error: unknown): Response {
  if (error instanceof AdminError) {
    return Response.json({ error: error.message }, { status: error.status });
  }
  console.error("[admin]", error);
  return Response.json({ error: "Something went wrong" }, { status: 500 });
}

export type AdminPlayerSummary = {
  id: string;
  displayName: string;
  publicSlug: string | null;
  userId: string | null;
  coins: number;
  eggs: number;
  food: number;
  materials: number;
  legacyPoints: number;
  spectatorPoints: number;
  rating: number;
  season: number;
  petCount: number;
  createdAt: string;
};

export type AdminPlayerDetail = AdminPlayerSummary & {
  pets: ReturnType<typeof petView>[];
};

const petCountColumn = sql<number>`(select count(*) from pets where owner_id = ${profiles.id})`;

function toSummary(row: Profile, petCount: number): AdminPlayerSummary {
  return {
    id: row.id,
    displayName: row.displayName,
    publicSlug: row.publicSlug,
    userId: row.userId,
    coins: row.coins,
    eggs: row.eggs,
    food: row.food,
    materials: row.materials,
    legacyPoints: row.legacyPoints,
    spectatorPoints: row.spectatorPoints,
    rating: row.rating,
    season: row.season,
    petCount,
    createdAt: row.createdAt.toISOString(),
  };
}

export async function searchPlayers(
  query: string,
  limit = 10,
): Promise<AdminPlayerSummary[]> {
  const trimmed = query.trim();
  if (!trimmed) return [];

  const db = await getDb();
  const rows = await db
    .select({ profile: profiles, petCount: petCountColumn })
    .from(profiles)
    .where(
      or(
        sql`${profiles.id}::text = ${trimmed}`,
        ilike(profiles.displayName, `%${trimmed}%`),
        ilike(profiles.publicSlug, `%${trimmed}%`),
      ),
    )
    .orderBy(desc(profiles.createdAt))
    .limit(Math.min(Math.max(limit, 1), 25));

  return rows.map((row) => toSummary(row.profile, Number(row.petCount)));
}

async function loadProfile(profileId: string): Promise<Profile> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  const profile = rows[0];
  if (!profile) throw new AdminError("Player not found", 404);
  return profile;
}

export async function getPlayer(profileId: string): Promise<AdminPlayerDetail> {
  const profile = await loadProfile(profileId);
  const db = await getDb();
  const rows = await db
    .select()
    .from(pets)
    .where(eq(pets.ownerId, profile.id))
    .orderBy(asc(pets.createdAt));
  const mastery = await getPetMasteryMap(rows.map((pet) => pet.id));

  return {
    ...toSummary(profile, rows.length),
    pets: rows.map((pet) => petView(pet, mastery[pet.id] ?? {})),
  };
}

export type WalletPatch = Partial<
  Pick<
    Profile,
    | "displayName"
    | "coins"
    | "eggs"
    | "food"
    | "materials"
    | "legacyPoints"
    | "spectatorPoints"
  >
>;

export async function updateWallet(
  profileId: string,
  patch: WalletPatch,
): Promise<AdminPlayerSummary> {
  await loadProfile(profileId);
  const db = await getDb();
  const rows = await db
    .update(profiles)
    .set(patch)
    .where(eq(profiles.id, profileId))
    .returning();
  const updated = rows[0];
  if (!updated) throw new AdminError("Player not found", 404);
  const [owned] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pets)
    .where(eq(pets.ownerId, profileId));
  return toSummary(updated, owned?.count ?? 0);
}

export type CreatePetInput = {
  profileId: string;
  mode: "custom" | "random";
  speciesId?: number;
  nickname?: string;
  rarity?: Rarity;
  nature?: NatureId;
  level?: number;
  exp?: number;
  star?: number;
  ivs?: Ivs;
  loadout?: number[] | null;
  statOverrides?: StatOverrides | null;
};

export async function createPetForPlayer(input: CreatePetInput) {
  const profile = await loadProfile(input.profileId);
  const db = await getDb();

  const [owned] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pets)
    .where(eq(pets.ownerId, profile.id));
  if ((owned?.count ?? 0) >= MAX_PETS) {
    throw new AdminError(`Ranch is full (${MAX_PETS} pets)`, 400);
  }

  const roll = input.mode === "random" ? rollHatch(crypto.randomUUID(), "wild") : null;
  const species = input.speciesId
    ? requireSpecies(input.speciesId)
    : roll?.species;
  if (!species) throw new AdminError("speciesId is required for custom pets", 422);
  if (!species.playable) {
    throw new AdminError(`Species ${species.id} cannot be generated`, 400);
  }

  const rarity = (input.rarity ?? roll?.rarity ?? 3) as Rarity;
  const nature = (input.nature ?? roll?.nature ?? "hardy") as NatureId;
  const ivs =
    input.ivs ??
    roll?.ivs ??
    rollIvsFor(rarity);

  const inserted = await db
    .insert(pets)
    .values({
      ownerId: profile.id,
      speciesId: species.id,
      nickname: input.nickname?.trim() || species.name,
      rarity,
      nature,
      level: input.level ?? 1,
      exp: input.exp ?? 0,
      star: input.star ?? 1,
      slot: null,
      ivs,
      care: defaultCare(),
      loadout: normalizeLoadout(species.skills, input.loadout ?? null),
      statOverrides: sanitizeOverrides(input.statOverrides),
    })
    .returning();

  await refreshPvpSnapshot(profile);
  return petView(inserted[0]);
}

function rollIvsFor(rarity: Rarity): Ivs {
  const floor = rarity >= 5 ? 22 : rarity >= 4 ? 16 : rarity >= 3 ? 10 : rarity >= 2 ? 5 : 0;
  const rng = new Rng(crypto.randomUUID());
  return {
    str: rng.int(floor, 31),
    agi: rng.int(floor, 31),
    vit: rng.int(floor, 31),
    int: rng.int(floor, 31),
    dex: rng.int(floor, 31),
    luk: rng.int(floor, 31),
  };
}

function sanitizeOverrides(
  overrides: StatOverrides | null | undefined,
): StatOverrides | null {
  if (!overrides) return null;
  const clean: StatOverrides = {};
  for (const key of STAT_OVERRIDE_KEYS) {
    const value = overrides[key];
    if (typeof value === "number" && Number.isFinite(value)) {
      clean[key] = value;
    }
  }
  return Object.keys(clean).length > 0 ? clean : null;
}

export type PetPatch = {
  nickname?: string;
  level?: number;
  exp?: number;
  rarity?: Rarity;
  nature?: NatureId;
  star?: number;
  evolutionStage?: number;
  ivs?: Ivs;
  loadout?: number[];
  statOverrides?: StatOverrides | null;
};

export async function updatePetAsAdmin(petId: string, patch: PetPatch) {
  const db = await getDb();
  const rows = await db.select().from(pets).where(eq(pets.id, petId)).limit(1);
  const pet = rows[0];
  if (!pet) throw new AdminError("Pet not found", 404);

  const species = requireSpecies(pet.speciesId);

  const update: Partial<typeof pets.$inferInsert> = {};
  if (patch.nickname !== undefined) update.nickname = patch.nickname;
  if (patch.level !== undefined) update.level = patch.level;
  if (patch.exp !== undefined) update.exp = patch.exp;
  if (patch.rarity !== undefined) update.rarity = patch.rarity;
  if (patch.nature !== undefined) update.nature = patch.nature;
  if (patch.star !== undefined) update.star = patch.star;
  if (patch.evolutionStage !== undefined) update.evolutionStage = patch.evolutionStage;
  if (patch.ivs !== undefined) update.ivs = patch.ivs;
  if (patch.statOverrides !== undefined) {
    update.statOverrides = sanitizeOverrides(patch.statOverrides);
  }
  if (patch.loadout !== undefined) {
    const ids = new Set(species.skills.map((slot) => slot.id));
    if (new Set(patch.loadout).size !== 4 || !patch.loadout.every((id) => ids.has(id))) {
      throw new AdminError("Loadout must be four unique skills from this species", 422);
    }
    update.loadout = patch.loadout;
  }

  if (Object.keys(update).length === 0) {
    throw new AdminError("Nothing to update", 422);
  }

  const updated = await db
    .update(pets)
    .set(update)
    .where(eq(pets.id, petId))
    .returning();

  const owner = await loadProfile(pet.ownerId);
  await refreshPvpSnapshot(owner);
  return petView(updated[0]);
}

export async function transferPet(petId: string, toProfileId: string) {
  const db = await getDb();
  const rows = await db.select().from(pets).where(eq(pets.id, petId)).limit(1);
  const pet = rows[0];
  if (!pet) throw new AdminError("Pet not found", 404);
  if (pet.ownerId === toProfileId) {
    throw new AdminError("That pet already belongs to this player", 400);
  }

  const target = await loadProfile(toProfileId);
  const [targetCount] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(pets)
    .where(eq(pets.ownerId, target.id));
  if ((targetCount?.count ?? 0) >= MAX_PETS) {
    throw new AdminError(`Ranch is full (${MAX_PETS} pets)`, 400);
  }

  const moved = await db.transaction(async (tx) => {
    await tx
      .update(marketListings)
      .set({ status: "cancelled" })
      .where(and(eq(marketListings.petId, petId), eq(marketListings.status, "active")));

    return tx
      .update(pets)
      .set({
        ownerId: target.id,
        slot: null,
        marketListed: false,
        expeditionId: null,
      })
      .where(and(eq(pets.id, petId), eq(pets.ownerId, pet.ownerId)))
      .returning();
  });

  const updated = moved[0];
  if (!updated) {
    throw new AdminError("Pet ownership changed while transferring", 409);
  }

  const previousOwner = await loadProfile(pet.ownerId);
  await refreshPvpSnapshot(previousOwner);
  await refreshPvpSnapshot(target);
  return petView(updated);
}

export async function recordAdminAction(
  identity: AdminIdentity,
  action: string,
  target: { profileId?: string | null; petId?: string | null; detail?: Record<string, unknown> },
): Promise<void> {
  try {
    const db = await getDb();
    await db.insert(adminAuditLog).values({
      actorLabel: identity.label,
      action,
      targetProfileId: target.profileId ?? null,
      targetPetId: target.petId ?? null,
      detail: target.detail ?? {},
    });
  } catch (error) {
    logEvent("warn", "admin.audit_failed", {
      action,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export async function listAudit(limit = 50) {
  const db = await getDb();
  return db
    .select()
    .from(adminAuditLog)
    .orderBy(desc(adminAuditLog.createdAt))
    .limit(Math.min(Math.max(limit, 1), 200));
}

export function isNatureId(value: string | undefined | null): value is NatureId {
  return !!value && (NATURE_IDS as readonly string[]).includes(value);
}

export { getSpecies };
