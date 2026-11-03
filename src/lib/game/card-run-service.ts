import { and, asc, desc, eq, gte, inArray, sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import {
  cardBattles,
  cardRuns,
  pets,
  profiles,
  type CardBattleRow,
  type CardRun,
  type Profile,
} from "@/lib/db/schema";
import { currentSeason } from "@/lib/db/auth";
import { Rng } from "@/lib/rng";
import { loadTeamPets, teamToCombatants } from "@/lib/game/team";
import { grantExp } from "@/lib/game/leveling";
import { recordQuestEventSafe } from "@/lib/game/quest-service";
import { checksum } from "@/lib/sim/checksum";
import { CardRuleError, applyCardAction, createCardBattle } from "@/lib/cards/engine";
import {
  CARD_DAILY_CAP,
  MAX_DECK_SIZE,
  advanceAfterBoss,
  applyScoreMultiplier,
  availableRunNodes,
  createChampions,
  createRun,
  lossRun,
  markNodeComplete,
  rewardForNode,
  rewardSummary,
} from "@/lib/cards/run";
import { buildEncounter } from "@/lib/cards/content/enemies";
import { addCard, removeCard, signatureInstance, upgradeInstance } from "@/lib/cards/deck";
import { cardForInstance, getCard } from "@/lib/cards/content/cards";
import { getRelic, evolveRelicId, isEvolvedRelic, relicPoolForAct } from "@/lib/cards/content/relics";
import { getEvent } from "@/lib/cards/content/events";
import { allRiftPaths, getRiftPath } from "@/lib/cards/content/paths";
import { allEdicts, getEdict, hasEdict } from "@/lib/cards/content/edicts";
import { isNodeReachable, nodeById } from "@/lib/cards/map";
import type {
  CardAction,
  CardBattleView,
  CardRewardOption,
  CardRunData,
  CardRunView,
  PendingNode,
} from "@/lib/cards/types";

function asRunData(row: CardRun): CardRunData {
  return {
    id: row.id,
    ownerId: row.ownerId,
    seed: row.seed,
    status: row.status,
    act: row.act,
    nodeId: row.nodeId,
    map: row.map,
    deck: row.deck,
    relics: row.relics,
    champions: row.champions,
    runGold: row.runGold,
    ascension: row.ascension,
    path: row.path,
    edicts: row.edicts,
    pending: row.pending ?? null,
    score: row.score,
    elapsedMs: row.elapsedMs,
    season: row.season,
    startedAt: row.startedAt.toISOString(),
    endedAt: row.endedAt?.toISOString() ?? null,
    completedNodeIds: row.completedNodeIds,
    rewardEssence: row.rewardEssence,
  };
}

function viewForRow(row: CardRun): CardRunView {
  const run = asRunData(row);
  const { seed: _seed, ...rest } = run;
  return {
    ...rest,
    availableNodes: availableRunNodes(run),
    deckCards: run.deck.cards.flatMap((instance) => {
      const definition = cardForInstance(
        instance.cardId,
        instance.upgraded,
        instance.signature,
      );
      return definition ? [{ ...instance, definition }] : [];
    }),
    relicDefinitions: run.relics.flatMap((id) => {
      const relic = getRelic(id);
      return relic ? [relic] : [];
    }),
  };
}

function battleView(row: CardBattleRow): CardBattleView {
  return {
    id: row.id,
    runId: row.runId,
    nodeId: row.nodeId,
    version: row.version,
    status: row.status as CardBattleView["status"],
    state: { ...row.state, seed: "" },
  };
}

export async function getActiveCardRun(profileId: string): Promise<CardRun | null> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(cardRuns)
    .where(and(eq(cardRuns.ownerId, profileId), eq(cardRuns.status, "active")))
    .limit(1);
  return rows[0] ?? null;
}

export async function startCardRun(
  profile: Profile,
  options: { ascension?: number; path?: string } = {},
): Promise<CardRunView> {
  const active = await getActiveCardRun(profile.id);
  if (active) return viewForRow(active);

  const team = await loadTeamPets(profile.id);
  if (team.length !== 3) {
    throw new CardRuleError("Field exactly three team pets before starting a run.", 422);
  }

  const db = await getDb();
  const wins = await db
    .select({ id: cardRuns.id })
    .from(cardRuns)
    .where(and(eq(cardRuns.ownerId, profile.id), eq(cardRuns.status, "won")));
  const maxAscension = Math.min(5, wins.length);
  const ascension = Math.max(0, Math.min(maxAscension, Math.round(options.ascension ?? 0)));
  const pathId = options.path ?? "balanced";
  if (!allRiftPaths().some((path) => path.id === pathId)) {
    throw new CardRuleError("Unknown Rift Path.", 422);
  }
  const path = getRiftPath(pathId);
  const edicts = profile.riftEdicts ?? [];
  const hpMultiplier =
    path.championHpMultiplier * (hasEdict(edicts, "iron-heart") ? 1.1 : 1);

  const champions = createChampions(teamToCombatants(team), hpMultiplier);
  const seed = crypto.randomUUID();
  const id = crypto.randomUUID();
  const season = await currentSeason();
  const data = createRun({
    id,
    ownerId: profile.id,
    seed,
    champions,
    season,
    startedAt: new Date().toISOString(),
    ascension,
    path: pathId,
    edicts,
    startGold: path.startGold,
  });

  if (hasEdict(edicts, "relic-seeker")) {
    const relic = relicPoolForAct(1)[new Rng(`edict-seeker:${seed}`).int(0, relicPoolForAct(1).length - 1)];
    if (relic) data.relics = [relic.id];
  }

  const inserted = await db
    .insert(cardRuns)
    .values({
      id,
      ownerId: profile.id,
      seed,
      status: "active",
      act: data.act,
      nodeId: null,
      map: data.map,
      deck: data.deck,
      relics: data.relics,
      champions: data.champions,
      runGold: data.runGold,
      ascension: data.ascension,
      path: data.path,
      edicts: data.edicts,
      pending: null,
      score: 0,
      elapsedMs: 0,
      season,
      completedNodeIds: [],
      startedAt: new Date(),
    })
    .onConflictDoNothing()
    .returning();

  if (inserted[0]) return viewForRow(inserted[0]);
  const raced = await getActiveCardRun(profile.id);
  if (!raced) throw new CardRuleError("Could not start a card run.", 500);
  return viewForRow(raced);
}

export async function loadCardRun(profileId: string, runId: string): Promise<CardRun> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(cardRuns)
    .where(and(eq(cardRuns.id, runId), eq(cardRuns.ownerId, profileId)))
    .limit(1);
  if (!rows[0]) throw new CardRuleError("Card run not found.", 404);
  return rows[0];
}

export async function loadCardRunView(profileId: string, runId: string): Promise<CardRunView> {
  return viewForRow(await loadCardRun(profileId, runId));
}

export async function getCardRunHub(profileId: string) {
  const db = await getDb();
  const active = await getActiveCardRun(profileId);
  const wins = await db
    .select({ id: cardRuns.id })
    .from(cardRuns)
    .where(and(eq(cardRuns.ownerId, profileId), eq(cardRuns.status, "won")));
  const best = await db
    .select()
    .from(cardRuns)
    .where(and(eq(cardRuns.ownerId, profileId), eq(cardRuns.status, "won")))
    .orderBy(desc(cardRuns.score), asc(cardRuns.elapsedMs))
    .limit(1);
  const profileRows = await db
    .select({ riftEssence: profiles.riftEssence, riftEdicts: profiles.riftEdicts })
    .from(profiles)
    .where(eq(profiles.id, profileId))
    .limit(1);
  const team = await loadTeamPets(profileId);
  const leaderboard = await getCardLeaderboard();
  return {
    activeRun: active ? viewForRow(active) : null,
    best: best[0] ? viewForRow(best[0]) : null,
    teamSize: team.length,
    canStart: team.length === 3,
    wins: wins.length,
    maxAscension: Math.min(5, wins.length),
    riftEssence: profileRows[0]?.riftEssence ?? 0,
    edicts: profileRows[0]?.riftEdicts ?? [],
    edictDefinitions: allEdicts(),
    paths: allRiftPaths(),
    leaderboard,
  };
}

export async function getCardLeaderboard(limit = 20) {
  const db = await getDb();
  const rows = await db
    .select({
      score: cardRuns.score,
      act: cardRuns.act,
      completedNodeIds: cardRuns.completedNodeIds,
      elapsedMs: cardRuns.elapsedMs,
      displayName: profiles.displayName,
    })
    .from(cardRuns)
    .innerJoin(profiles, eq(cardRuns.ownerId, profiles.id))
    .where(eq(cardRuns.status, "won"))
    .orderBy(desc(cardRuns.score), asc(cardRuns.elapsedMs))
    .limit(limit);

  return rows.map((row, index) => ({
    rank: index + 1,
    displayName: row.displayName,
    score: row.score,
    act: row.act,
    rooms: row.completedNodeIds.length,
    elapsedMs: row.elapsedMs,
  }));
}

function pendingBattleFor(runId: string, nodeId: string) {
  return and(
    eq(cardBattles.runId, runId),
    eq(cardBattles.nodeId, nodeId),
    eq(cardBattles.status, "pending"),
  );
}

function cardChoiceCount(run: CardRunData, boss = false): number {
  const path = getRiftPath(run.path);
  const edict = hasEdict(run.edicts, "rift-hunger") ? 1 : 0;
  const ascensionPenalty = run.ascension >= 4 ? 1 : 0;
  return Math.max(1, 3 + path.rewardBonus + edict + (boss ? 0 : 0) - ascensionPenalty);
}

function encounterMods(run: CardRunData, boss: boolean) {
  const path = getRiftPath(run.path);
  const ascensionHp = run.ascension >= 1 ? 1.1 : 1;
  const bossHp = boss && run.ascension >= 5 ? 1.2 : 1;
  const ascensionDamage = run.ascension >= 2 ? 1.1 : 1;
  return {
    hpMultiplier: path.enemyHpMultiplier * ascensionHp * bossHp,
    damageMultiplier: path.enemyDamageMultiplier * ascensionDamage,
  };
}

export async function enterCardNode(
  profileId: string,
  runId: string,
  nodeId: string,
): Promise<{ run: CardRunView; battle: CardBattleView | null }> {
  const row = await loadCardRun(profileId, runId);
  const run = asRunData(row);
  if (run.status !== "active") throw new CardRuleError("This run is over.", 409);
  if (run.pending) throw new CardRuleError("Resolve the current node first.", 409);
  if (!isNodeReachable(run, nodeId)) throw new CardRuleError("That node is not reachable.", 422);

  const node = nodeById(run.map, nodeId);
  if (!node) throw new CardRuleError("Node not found.", 404);

  const db = await getDb();
  const existing = await db
    .select()
    .from(cardBattles)
    .where(pendingBattleFor(runId, nodeId))
    .limit(1);
  if (existing[0]) {
    return { run: viewForRow(row), battle: battleView(existing[0]) };
  }

  if (node.type === "battle" || node.type === "elite" || node.type === "boss") {
    const kind = node.type === "boss" ? "boss" : node.type === "elite" ? "elite" : "normal";
    const enemies = buildEncounter(run.seed, run.act, kind, node.floor, encounterMods(run, kind === "boss"));
    const battleSeed = checksum(`${run.seed}:${node.id}`);
    const state = createCardBattle({
      seed: battleSeed,
      champions: run.champions,
      enemies,
      deck: run.deck.cards,
      relics: run.relics,
      edicts: run.edicts,
    });
    const inserted = await db
      .insert(cardBattles)
      .values({
        ownerId: profileId,
        runId,
        nodeId,
        seed: battleSeed,
        state,
        inputLog: [],
        version: 0,
        status: "pending",
      })
      .returning();
    if (!inserted[0]) throw new CardRuleError("Could not create the card battle.", 500);
    return { run: viewForRow(row), battle: battleView(inserted[0]) };
  }

  const pending = rewardForNode(run.seed, run.act, node, run.deck.cards.length, run.relics, {
    cardCount: cardChoiceCount(run),
  });
  if (!pending) throw new CardRuleError("This node has no interaction.", 422);
  const updated = await db
    .update(cardRuns)
    .set({ pending })
    .where(eq(cardRuns.id, runId))
    .returning();
  if (!updated[0]) throw new CardRuleError("Could not enter the node.", 500);
  return { run: viewForRow(updated[0]), battle: null };
}

export async function loadCardBattle(profileId: string, battleId: string): Promise<CardBattleRow> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(cardBattles)
    .where(and(eq(cardBattles.id, battleId), eq(cardBattles.ownerId, profileId)))
    .limit(1);
  if (!rows[0]) throw new CardRuleError("Card battle not found.", 404);
  return rows[0];
}

export async function loadCardBattleView(
  profileId: string,
  battleId: string,
): Promise<CardBattleView> {
  return battleView(await loadCardBattle(profileId, battleId));
}

export async function actOnCardBattle(
  profile: Profile,
  battleId: string,
  version: number,
  action: CardAction,
): Promise<{ battle: CardBattleView; run: CardRunView; reward: ReturnType<typeof rewardSummary> | null }> {
  const db = await getDb();
  const output = await db.transaction(async (tx) => {
    const battleRows = await tx
      .select()
      .from(cardBattles)
      .where(and(eq(cardBattles.id, battleId), eq(cardBattles.ownerId, profile.id)))
      .limit(1);
    const battle = battleRows[0];
    if (!battle) throw new CardRuleError("Card battle not found.", 404);
    if (battle.status !== "pending") throw new CardRuleError("This battle is already over.", 409);
    if (battle.version !== version) throw new CardRuleError("Battle state changed; refresh.", 409);

    const runRows = await tx
      .select()
      .from(cardRuns)
      .where(and(eq(cardRuns.id, battle.runId), eq(cardRuns.ownerId, profile.id)))
      .limit(1);
    const runRow = runRows[0];
    if (!runRow) throw new CardRuleError("Card run not found.", 404);
    let run = asRunData(runRow);
    const state = applyCardAction(battle.state, action);
    const nextVersion = battle.version + 1;
    let battleStatus = battle.status;
    let pending: PendingNode | null = run.pending;
    let scoreRun = run;
    let reward: ReturnType<typeof rewardSummary> | null = null;

    if (state.phase === "lost") {
      scoreRun = lossRun({ ...run, champions: state.champions, pending: null });
      battleStatus = "lost";
      pending = null;
      reward = rewardSummary(scoreRun);
    } else if (state.phase === "won") {
      const node = nodeById(run.map, battle.nodeId);
      if (node) {
        const runGold =
          node.type === "boss" ? 40 : node.type === "elite" ? 20 : 10;
        const goldBonus = run.relics.reduce(
          (sum, id) => sum + (getRelic(id)?.effect.goldBonus ?? 0),
          0,
        );
        const withGold = {
          ...run,
          champions: state.champions,
          runGold: run.runGold + Math.round(runGold * (1 + goldBonus)),
        };
        const healed = applyPostBattleHeal(withGold);
        const rewardNode = rewardForNode(
          run.seed,
          run.act,
          node,
          run.deck.cards.length,
          run.relics,
          { cardCount: cardChoiceCount(run, node.type === "boss") },
        );
        scoreRun = markNodeComplete({ ...healed, pending: rewardNode }, node.id);
        pending = rewardNode;
        if (node.type === "boss") {
          scoreRun = advanceAfterBoss(scoreRun);
          reward = rewardSummary(scoreRun);
        }
      }
      battleStatus = "complete";
    }

    if (scoreRun.status === "won" || scoreRun.status === "lost") {
      scoreRun = {
        ...scoreRun,
        score: applyScoreMultiplier(
          scoreRun.score,
          scoreRun.ascension,
          getRiftPath(scoreRun.path).scoreMultiplier,
        ),
      };
    }

    const updatedBattle = await tx
      .update(cardBattles)
      .set({
        state,
        inputLog: [...battle.inputLog, action],
        version: nextVersion,
        status: battleStatus,
        result: state.result,
        resultHash: state.result?.checksum ?? null,
        completedAt: state.result ? new Date() : null,
      })
      .where(and(eq(cardBattles.id, battleId), eq(cardBattles.version, version)))
      .returning();
    if (!updatedBattle[0]) throw new CardRuleError("Battle state changed; refresh.", 409);

    const updatedRun = await tx
      .update(cardRuns)
      .set({
        status: scoreRun.status,
        act: scoreRun.act,
        nodeId: scoreRun.nodeId,
        champions: scoreRun.champions,
        runGold: scoreRun.runGold,
        ascension: scoreRun.ascension,
        path: scoreRun.path,
        edicts: scoreRun.edicts,
        pending: scoreRun.pending,
        score: scoreRun.score,
        completedNodeIds: scoreRun.completedNodeIds,
        endedAt: scoreRun.endedAt ? new Date(scoreRun.endedAt) : null,
      })
      .where(eq(cardRuns.id, run.id))
      .returning();
    if (!updatedRun[0]) throw new CardRuleError("Could not update the run.", 500);
    run = asRunData(updatedRun[0]);
    return { battle: battleView(updatedBattle[0]), run: viewForRow(updatedRun[0]), reward };
  });

  if (output.battle.status === "complete") {
    await recordQuestEventSafe(profile.id, "card_win", 1);
    await recordQuestEventSafe(profile.id, "card_room", 1);
    if (output.run.status === "won") {
      await recordQuestEventSafe(profile.id, "card_run", 1);
    }
  }
  if (output.run.status === "won" || output.run.status === "lost") {
    await grantCardRunRewards(profile, output.run.id);
  }
  return output;
}

function applyPostBattleHeal(run: CardRunData): CardRunData {
  const heal = run.relics.reduce(
    (sum, id) => sum + (getRelic(id)?.effect.healAfterBattle ?? 0),
    0,
  );
  if (!heal) return run;
  return {
    ...run,
    champions: run.champions.map((champion) => ({
      ...champion,
      hp: Math.min(champion.maxHp, champion.hp + heal),
    })),
  };
}

export async function claimCardReward(
  profileId: string,
  runId: string,
  choice: { choice: "card" | "relic" | "skip"; id?: string },
): Promise<CardRunView> {
  const row = await loadCardRun(profileId, runId);
  const run = asRunData(row);
  if (!run.pending || run.pending.kind !== "reward") {
    throw new CardRuleError("No card reward is pending.", 409);
  }
  let deck = run.deck;
  let relics = run.relics;
  if (choice.choice === "card") {
    const option = run.pending.options.find((entry) => entry.id === choice.id);
    if (!option) throw new CardRuleError("That reward is not offered.", 422);
    if (deck.cards.length >= MAX_DECK_SIZE) throw new CardRuleError("Deck is full.", 422);
    const owner = run.champions[0]?.petId;
    if (!owner) throw new CardRuleError("No champion to own this card.", 422);
    deck = addCard(deck, option.id, owner).deck;
  } else if (choice.choice === "relic") {
    if (!run.pending.relic || run.pending.relic.id !== choice.id) {
      throw new CardRuleError("That relic is not offered.", 422);
    }
    if (relics.includes(choice.id)) throw new CardRuleError("Relic already owned.", 422);
    relics = [...relics, choice.id];
  }

  const pending = run.pending;
  const completed = run.completedNodeIds.includes(pending.nodeId)
    ? run.completedNodeIds
    : [...run.completedNodeIds, pending.nodeId];
  const pendingNode = nodeById(run.map, pending.nodeId);
  const advancedAct = run.nodeId === null && pendingNode && run.act > pendingNode.act;
  const db = await getDb();
  const updated = await db
    .update(cardRuns)
    .set({
      deck,
      relics,
      pending: null,
      completedNodeIds: completed,
      nodeId: advancedAct ? null : (run.nodeId ?? pending.nodeId),
      score: run.score + (run.completedNodeIds.includes(pending.nodeId) ? 0 : 10),
    })
    .where(eq(cardRuns.id, runId))
    .returning();
  if (!updated[0]) throw new CardRuleError("Could not claim the reward.", 500);
  return viewForRow(updated[0]);
}

export async function resolveRest(
  profileId: string,
  runId: string,
  choice: { choice: "heal" | "upgrade" | "signature"; instanceId?: string },
): Promise<CardRunView> {
  const row = await loadCardRun(profileId, runId);
  const run = asRunData(row);
  if (!run.pending || run.pending.kind !== "rest") {
    throw new CardRuleError("No rest site is pending.", 409);
  }
  let champions = run.champions;
  let deck = run.deck;
  if (choice.choice === "heal") {
    const relicBonus = run.relics.reduce(
      (sum, id) => sum + (getRelic(id)?.effect.restHealBonus ?? 0),
      0,
    );
    const path = getRiftPath(run.path);
    const ascensionPenalty = run.ascension >= 3 ? 0.1 : 0;
    champions = championHeal(
      run.champions,
      Math.max(0, 0.3 + relicBonus + path.restBonus - ascensionPenalty),
    );
  } else if (choice.choice === "signature") {
    if (!choice.instanceId) throw new CardRuleError("Choose a card to forge.", 422);
    const target = deck.cards.find((card) => card.instanceId === choice.instanceId);
    if (!target) throw new CardRuleError("Card not found.", 422);
    if (target.signature) throw new CardRuleError("This card is already a signature.", 422);
    const duplicate = deck.cards.find(
      (card) => card.instanceId !== target.instanceId && card.cardId === target.cardId,
    );
    if (!duplicate) {
      throw new CardRuleError("Signature forging needs a duplicate copy of the card.", 422);
    }
    deck = signatureInstance(removeCard(deck, duplicate.instanceId), target.instanceId);
  } else {
    if (!choice.instanceId) throw new CardRuleError("Choose a card to upgrade.", 422);
    const target = deck.cards.find((card) => card.instanceId === choice.instanceId);
    if (!target) throw new CardRuleError("Card not found.", 422);
    if (target.signature) throw new CardRuleError("Signature cards cannot be upgraded further.", 422);
    deck = upgradeInstance(deck, choice.instanceId);
  }
  const nodeId = run.pending.nodeId;
  const db = await getDb();
  const updated = await db
    .update(cardRuns)
    .set({
      champions,
      deck,
      pending: null,
      completedNodeIds: [...run.completedNodeIds, nodeId],
      nodeId,
      score: run.score + 10,
    })
    .where(eq(cardRuns.id, runId))
    .returning();
  if (!updated[0]) throw new CardRuleError("Could not rest.", 500);
  return viewForRow(updated[0]);
}

export async function resolveShop(
  profileId: string,
  runId: string,
  body:
    | { action: "leave" }
    | { action: "buy"; kind: "card" | "relic"; id: string }
    | { action: "remove"; instanceId: string }
    | { action: "evolve"; relicId: string },
): Promise<CardRunView> {
  const row = await loadCardRun(profileId, runId);
  const run = asRunData(row);
  if (!run.pending || run.pending.kind !== "shop") {
    throw new CardRuleError("No shop is pending.", 409);
  }
  if (body.action === "leave") {
    const nodeId = run.pending.nodeId;
    const db = await getDb();
    const updated = await db
      .update(cardRuns)
      .set({
        pending: null,
        completedNodeIds: [...run.completedNodeIds, nodeId],
        nodeId,
        score: run.score + 10,
      })
      .where(eq(cardRuns.id, runId))
      .returning();
    if (!updated[0]) throw new CardRuleError("Could not leave the shop.", 500);
    return viewForRow(updated[0]);
  }

  const path = getRiftPath(run.path);
  const discount = Math.min(
    0.5,
    path.shopDiscount +
      run.relics.reduce(
        (sum, id) => sum + (getRelic(id)?.effect.shopDiscount ?? 0),
        0,
      ),
  );
  let runGold = run.runGold;
  let deck = run.deck;
  let relics = run.relics;

  if (body.action === "evolve") {
    const base = run.relics.find((id) => id === body.relicId);
    if (!base || isEvolvedRelic(base)) throw new CardRuleError("Relic cannot be evolved.", 422);
    const cost = Math.round(100 * (1 - discount));
    if (runGold < cost) throw new CardRuleError("Not enough run gold.", 422);
    runGold -= cost;
    relics = relics.map((id) => (id === body.relicId ? evolveRelicId(id) : id));
  } else if (body.action === "remove") {
    const cost = Math.round(run.pending.removalCost * (1 - discount));
    if (runGold < cost) throw new CardRuleError("Not enough run gold.", 422);
    if (!deck.cards.some((card) => card.instanceId === body.instanceId)) {
      throw new CardRuleError("Card not found.", 422);
    }
    runGold -= cost;
    deck = removeCard(deck, body.instanceId);
  } else {
    const option: CardRewardOption | undefined =
      body.kind === "relic"
        ? run.pending.relic
        : run.pending.cards.find((card) => card.id === body.id);
    if (!option || option.id !== body.id) throw new CardRuleError("Item not found.", 422);
    const cost = Math.round((option.price ?? 60) * (1 - discount));
    if (runGold < cost) throw new CardRuleError("Not enough run gold.", 422);
    if (body.kind === "card") {
      if (deck.cards.length >= MAX_DECK_SIZE) throw new CardRuleError("Deck is full.", 422);
      deck = addCard(deck, option.id, run.champions[0]?.petId ?? "shop").deck;
    } else {
      if (relics.includes(option.id)) throw new CardRuleError("Relic already owned.", 422);
      relics = [...relics, option.id];
    }
    runGold -= cost;
  }

  const db = await getDb();
  const updated = await db
    .update(cardRuns)
    .set({ runGold, deck, relics })
    .where(eq(cardRuns.id, runId))
    .returning();
  if (!updated[0]) throw new CardRuleError("Could not update the shop.", 500);
  return viewForRow(updated[0]);
}

export async function resolveEvent(
  profileId: string,
  runId: string,
  choiceId: string,
): Promise<CardRunView> {
  const row = await loadCardRun(profileId, runId);
  const run = asRunData(row);
  if (!run.pending || run.pending.kind !== "event") {
    throw new CardRuleError("No event is pending.", 409);
  }
  const event = getEvent(run.pending.eventId);
  const option = event?.options.find((entry) => entry.id === choiceId);
  if (!option) throw new CardRuleError("Event choice not found.", 422);

  let champions = run.champions;
  let deck = run.deck;
  let relics = run.relics;
  let runGold = run.runGold;

  switch (option.effect.kind) {
    case "heal":
      champions = championHeal(champions, option.effect.amount / 100);
      break;
    case "gold":
      runGold += option.effect.amount;
      break;
    case "damage": {
      const amount = option.effect.amount;
      champions = champions.map((champion) => ({
        ...champion,
        hp: Math.max(1, champion.hp - amount),
      }));
      break;
    }
    case "card": {
      const cardId =
        option.effect.cardId === "upgrade-random"
          ? null
          : option.effect.cardId;
      if (cardId && getCard(cardId)) {
        deck = addCard(deck, cardId, run.champions[0]?.petId ?? "event").deck;
      } else if (option.effect.cardId === "upgrade-random") {
        const target = deck.cards.find((card) => !card.upgraded);
        if (target) deck = upgradeInstance(deck, target.instanceId);
      }
      break;
    }
    case "relic": {
      const relic =
        option.effect.relicId === "random"
          ? randomRelic(run.seed, run.act, relics)
          : getRelic(option.effect.relicId);
      if (relic && !relics.includes(relic.id)) relics = [...relics, relic.id];
      break;
    }
  }

  const nodeId = run.pending.nodeId;
  const db = await getDb();
  const updated = await db
    .update(cardRuns)
    .set({
      champions,
      deck,
      relics,
      runGold,
      pending: null,
      completedNodeIds: [...run.completedNodeIds, nodeId],
      nodeId,
      score: run.score + 10,
    })
    .where(eq(cardRuns.id, runId))
    .returning();
  if (!updated[0]) throw new CardRuleError("Could not resolve the event.", 500);
  return viewForRow(updated[0]);
}

function championHeal(champions: CardRunData["champions"], fraction: number) {
  return champions.map((champion) => ({
    ...champion,
    hp: Math.min(champion.maxHp, Math.round(champion.hp + champion.maxHp * fraction)),
  }));
}

function randomRelic(seed: string, act: number, owned: string[]) {
  const pool = relicPoolForAct(act).filter((relic) => !owned.includes(relic.id));
  if (!pool.length) return null;
  return pool[new Rng(`event-relic:${seed}:${act}`).int(0, pool.length - 1)];
}

export async function abandonCardRun(profileId: string, runId: string): Promise<CardRunView> {
  const row = await loadCardRun(profileId, runId);
  if (row.status !== "active") throw new CardRuleError("This run is already over.", 409);
  const db = await getDb();
  const updated = await db
    .update(cardRuns)
    .set({ status: "abandoned", pending: null, endedAt: new Date() })
    .where(and(eq(cardRuns.id, runId), eq(cardRuns.ownerId, profileId)))
    .returning();
  if (!updated[0]) throw new CardRuleError("Could not abandon the run.", 500);
  return viewForRow(updated[0]);
}

export async function grantCardRunRewards(profile: Profile, runId: string): Promise<void> {
  const db = await getDb();
  const rows = await db
    .select()
    .from(cardRuns)
    .where(and(eq(cardRuns.id, runId), eq(cardRuns.ownerId, profile.id)))
    .limit(1);
  const run = rows[0];
  if (!run || run.rewardedAt || (run.status !== "won" && run.status !== "lost")) return;
  const summary = rewardSummary(asRunData(run));

  const start = new Date();
  start.setUTCHours(0, 0, 0, 0);
  const daily = await db
    .select({
      coins: sql<number>`coalesce(sum(${cardRuns.rewardCoins}), 0)`,
      materials: sql<number>`coalesce(sum(${cardRuns.rewardMaterials}), 0)`,
      eggs: sql<number>`coalesce(sum(${cardRuns.rewardEggs}), 0)`,
    })
    .from(cardRuns)
    .where(and(eq(cardRuns.ownerId, profile.id), gte(cardRuns.rewardedAt, start)));

  const coins = Math.max(0, Math.min(summary.coins, CARD_DAILY_CAP.coins - Number(daily[0]?.coins ?? 0)));
  const materials = Math.max(
    0,
    Math.min(summary.materials, CARD_DAILY_CAP.materials - Number(daily[0]?.materials ?? 0)),
  );
  const eggs = Math.max(0, Math.min(summary.eggs, CARD_DAILY_CAP.eggs - Number(daily[0]?.eggs ?? 0)));
  const bossCount = run.completedNodeIds.filter(
    (nodeId) => nodeById(run.map, nodeId)?.type === "boss",
  ).length;
  const essence = summary.essence + bossCount;

  await db.transaction(async (tx) => {
    await tx
      .update(profiles)
      .set({
        coins: sql`${profiles.coins} + ${coins}`,
        materials: sql`${profiles.materials} + ${materials}`,
        eggs: sql`${profiles.eggs} + ${eggs}`,
        riftEssence: sql`${profiles.riftEssence} + ${essence}`,
      })
      .where(eq(profiles.id, profile.id));

    if (run.champions.length && summary.xp > 0) {
      const petIds = run.champions.map((champion) => champion.petId);
      const rows = await tx
        .select()
        .from(pets)
        .where(and(eq(pets.ownerId, profile.id), inArray(pets.id, petIds)));
      for (const pet of rows) {
        const level = grantExp(pet.level, pet.exp, summary.xp);
        await tx
          .update(pets)
          .set({ level: level.level, exp: level.exp })
          .where(eq(pets.id, pet.id));
      }
    }

    await tx
      .update(cardRuns)
      .set({
        rewardCoins: coins,
        rewardMaterials: materials,
        rewardEggs: eggs,
        rewardXp: summary.xp,
        rewardEssence: essence,
        rewardedAt: new Date(),
      })
      .where(eq(cardRuns.id, runId));
  });
}

export async function purchaseEdict(
  profile: Profile,
  id: string,
): Promise<{ essence: number; edicts: string[] }> {
  const edict = getEdict(id);
  if (!edict) throw new CardRuleError("Unknown Rift Edict.", 404);
  const db = await getDb();
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({
        riftEssence: profiles.riftEssence,
        riftEdicts: profiles.riftEdicts,
      })
      .from(profiles)
      .where(eq(profiles.id, profile.id))
      .limit(1);
    const current = rows[0];
    if (!current) throw new CardRuleError("Profile not found.", 404);
    if (current.riftEdicts.includes(id)) {
      throw new CardRuleError("That edict is already owned.", 409);
    }
    if (current.riftEssence < edict.cost) {
      throw new CardRuleError("Not enough Rift Essence.", 422);
    }
    const edicts = [...current.riftEdicts, id];
    const updated = await tx
      .update(profiles)
      .set({
        riftEssence: current.riftEssence - edict.cost,
        riftEdicts: edicts,
      })
      .where(eq(profiles.id, profile.id))
      .returning({ riftEssence: profiles.riftEssence, riftEdicts: profiles.riftEdicts });
    return {
      essence: updated[0]?.riftEssence ?? current.riftEssence - edict.cost,
      edicts: updated[0]?.riftEdicts ?? edicts,
    };
  });
}

export function assertRunOwner(run: CardRun, profileId: string): void {
  if (run.ownerId !== profileId) throw new CardRuleError("Card run not found.", 404);
}
