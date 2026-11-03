import { Rng } from "@/lib/rng";
import { checksum } from "@/lib/sim/checksum";
import { battleElementMultiplier } from "@/lib/game/combat-data";
import type { CardDefinition, CardEffect, CardStatus, CardStatusKind } from "./types";
import type {
  CardAction,
  CardBattleResult,
  CardBattleState,
  CardChampion,
  CardEnemy,
  CardEvent,
  CardInstance,
  EnemyMove,
} from "./types";
import { cardForInstance } from "./content/cards";
import { getRelic } from "./content/relics";

export class CardRuleError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
    this.name = "CardRuleError";
  }
}

const clone = <T>(value: T): T => JSON.parse(JSON.stringify(value)) as T;

function rngFor(state: CardBattleState, label: string): Rng {
  const rng = new Rng(`${state.seed}:${label}:${state.rngCounter}`);
  state.rngCounter += 1;
  return rng;
}

function livingChampions(state: CardBattleState): CardChampion[] {
  return state.champions.filter((champion) => champion.hp > 0);
}

function livingEnemies(state: CardBattleState): CardEnemy[] {
  return state.enemies.filter((enemy) => enemy.hp > 0);
}

function championById(state: CardBattleState, id: string | undefined): CardChampion | undefined {
  return state.champions.find((champion) => champion.petId === id);
}

function enemyById(state: CardBattleState, id: string | undefined): CardEnemy | undefined {
  return state.enemies.find((enemy) => enemy.id === id);
}

function cardOwner(state: CardBattleState, instance: CardInstance): CardChampion | undefined {
  return championById(state, instance.ownerPetId);
}

function statusOf(unit: { statuses: CardStatus[] }, kind: CardStatusKind): CardStatus | undefined {
  return unit.statuses.find((status) => status.kind === kind);
}

function statusStacks(unit: { statuses: CardStatus[] }, kind: CardStatusKind): number {
  return statusOf(unit, kind)?.stacks ?? 0;
}

function hasStatus(unit: { statuses: CardStatus[] }, kind: CardStatusKind): boolean {
  return Boolean(statusOf(unit, kind));
}

function addStatus(
  unit: { statuses: CardStatus[] },
  kind: CardStatusKind,
  stacks: number,
  turns: number,
): void {
  const existing = statusOf(unit, kind);
  if (existing) {
    existing.stacks = Math.max(existing.stacks, stacks);
    existing.remaining = Math.max(existing.remaining, turns);
    return;
  }
  if (unit.statuses.length >= 6) unit.statuses.shift();
  unit.statuses.push({ kind, stacks, remaining: turns });
}

function tickStatuses(unit: { statuses: CardStatus[] }): void {
  for (const status of unit.statuses) status.remaining -= 1;
  unit.statuses = unit.statuses.filter((status) => status.remaining > 0);
}

function addEvent(
  state: CardBattleState,
  type: string,
  text: string,
  targetId?: string,
  amount?: number,
): void {
  state.events.push({ type, text, targetId, amount });
  if (state.events.length > 180) state.events = state.events.slice(-180);
}

function drawCards(state: CardBattleState, count: number): void {
  for (let index = 0; index < count; index += 1) {
    if (state.hand.length >= 10) break;
    if (state.drawPile.length === 0) {
      if (state.discardPile.length === 0) break;
      const rng = rngFor(state, "reshuffle");
      state.drawPile = shuffleInPlace([...state.discardPile], rng);
      state.discardPile = [];
      addEvent(state, "reshuffle", "The discard pile is shuffled back into the deck.");
    }
    const card = state.drawPile.pop();
    if (card) state.hand.push(card);
  }
}

function shuffleInPlace<T>(items: T[], rng: Rng): T[] {
  for (let index = items.length - 1; index > 0; index -= 1) {
    const swap = rng.int(0, index);
    [items[index], items[swap]] = [items[swap], items[index]];
  }
  return items;
}

function definitionFor(instance: CardInstance): CardDefinition {
  const definition = cardForInstance(instance.cardId, instance.upgraded, instance.signature);
  if (!definition) throw new CardRuleError(`Unknown card ${instance.cardId}`, 500);
  return definition;
}

function effectiveDefense(defense: number, unit: { statuses: CardStatus[] }): number {
  const up = statusStacks(unit, "defUp");
  const down = statusStacks(unit, "defDown");
  return Math.max(0, defense * (1 + up * 0.15 - down * 0.15));
}

function mitigation(defense: number): number {
  return 1 - defense / (defense + 500);
}

function damageModifiers(attacker: { statuses: CardStatus[] }, defender: { statuses: CardStatus[] }) {
  const weak = hasStatus(attacker, "weak") ? 0.75 : 1;
  const vulnerable = hasStatus(defender, "vulnerable") ? 1.5 : 1;
  const haste = hasStatus(attacker, "haste") ? 1.1 : 1;
  const slow = hasStatus(attacker, "slow") ? 0.9 : 1;
  const shield = Math.max(0, statusStacks(defender, "shield")) * 0.1;
  return weak * vulnerable * haste * slow * Math.max(0, 1 - Math.min(0.6, shield));
}

function damageEnemy(
  state: CardBattleState,
  champion: CardChampion,
  enemy: CardEnemy,
  effect: Extract<CardEffect, { kind: "damage" }>,
  card: CardDefinition,
): number {
  const hits = effect.hits ?? 1;
  let total = 0;
  const stat = effect.stat ?? "atk";
  const base = stat === "matk" ? champion.stats.matk : champion.stats.atk;
  const element = card.element ?? champion.element;
  const elementMult = battleElementMultiplier(element, enemy.element, champion.elementLevel);
  const relicBonus = state.relics.reduce((sum, id) => {
    const relic = getRelic(id);
    return sum + (relic?.effect.elementBonus?.[element] ?? 0);
  }, 0);
  const attackUp = 1 + statusStacks(champion, "atkUp") * 0.15;
  const mods = damageModifiers(champion, enemy);
  const firstBonus =
    !state.firstAttackUsed && state.relics.some((id) => getRelic(id)?.effect.firstAttackBonus)
      ? (getRelic(state.relics.find((id) => getRelic(id)?.effect.firstAttackBonus)!)?.effect
          .firstAttackBonus ?? 0)
      : 0;

  for (let hit = 0; hit < hits; hit += 1) {
    const raw = (base * effect.power) / 100 * elementMult * (1 + relicBonus) * attackUp * mods;
    const dealt = Math.max(
      1,
      Math.floor(
        raw * mitigation(effectiveDefense(enemy.stats.def, enemy)) +
          (hit === 0 ? firstBonus : 0),
      ),
    );
    const blocked = Math.min(enemy.block, dealt);
    enemy.block -= blocked;
    const hpDamage = dealt - blocked;
    enemy.hp = Math.max(0, enemy.hp - hpDamage);
    total += hpDamage;
  }

  if (hasStatus(champion, "poison") && card.effects.some((entry) => entry.kind === "damage")) {
    // Poison is applied at the end of the turn; the attacker does not take it here.
  }
  if (firstBonus > 0) state.firstAttackUsed = true;
  addEvent(state, "damage", `${champion.name} hits ${enemy.name} for ${total}.`, enemy.id, total);
  if (enemy.hp <= 0) addEvent(state, "faint", `${enemy.name} falls.`, enemy.id);
  return total;
}

function damageChampion(
  state: CardBattleState,
  enemy: CardEnemy,
  champion: CardChampion,
  power: number,
  hits = 1,
): number {
  let total = 0;
  const elementMult = battleElementMultiplier(enemy.element, champion.element, enemy.elementLevel);
  const attackUp = 1 + statusStacks(enemy, "atkUp") * 0.15;
  const mods = damageModifiers(enemy, champion);
  for (let hit = 0; hit < hits; hit += 1) {
    const raw = (enemy.stats.atk * power) / 100 * elementMult * attackUp * mods;
    const dealt = Math.max(
      1,
      Math.floor(raw * mitigation(effectiveDefense(champion.stats.def, champion))),
    );
    const blocked = Math.min(champion.block, dealt);
    champion.block -= blocked;
    const hpDamage = dealt - blocked;
    champion.hp = Math.max(0, champion.hp - hpDamage);
    total += hpDamage;
  }
  addEvent(state, "damage", `${enemy.name} hits ${champion.name} for ${total}.`, champion.petId, total);
  if (champion.hp <= 0) {
    if (state.edicts.includes("second-wind") && !state.secondWindUsed) {
      champion.hp = Math.max(1, Math.floor(champion.maxHp * 0.25));
      state.secondWindUsed = true;
      addEvent(state, "revive", `${champion.name} is revived by Second Wind.`, champion.petId);
    } else {
      addEvent(state, "faint", `${champion.name} falls.`, champion.petId);
      exhaustChampionCards(state, champion.petId);
    }
  }
  return total;
}

function exhaustChampionCards(state: CardBattleState, petId: string): void {
  const isOwned = (card: CardInstance) => card.ownerPetId === petId;
  const removed = [...state.hand, ...state.drawPile, ...state.discardPile].filter(isOwned);
  if (removed.length === 0) return;
  state.hand = state.hand.filter((card) => !isOwned(card));
  state.drawPile = state.drawPile.filter((card) => !isOwned(card));
  state.discardPile = state.discardPile.filter((card) => !isOwned(card));
  state.exhaustPile.push(...removed);
}

function healChampion(champion: CardChampion, amount: number): number {
  const healed = Math.min(champion.maxHp - champion.hp, Math.max(0, Math.round(amount)));
  champion.hp += healed;
  return healed;
}

function allEffectTargets(
  state: CardBattleState,
  effectTarget: string | undefined,
  chosenId: string | undefined,
): { champions: CardChampion[]; enemies: CardEnemy[] } {
  const livingC = livingChampions(state);
  const livingE = livingEnemies(state);

  switch (effectTarget) {
    case "self":
      return { champions: [], enemies: [] };
    case "allAllies":
      return { champions: livingC, enemies: [] };
    case "allEnemies":
      return { champions: [], enemies: livingE };
    case "ally":
      return {
        champions: chosenId
          ? [championById(state, chosenId)].filter((entry): entry is CardChampion => Boolean(entry))
          : [],
        enemies: [],
      };
    case "enemy":
      return {
        champions: [],
        enemies: chosenId
          ? [enemyById(state, chosenId)].filter((entry): entry is CardEnemy => Boolean(entry))
          : [],
      };
    case "randomEnemy":
      return {
        champions: [],
        enemies: livingE.length
          ? [livingE[rngFor(state, "random-target").int(0, livingE.length - 1)]]
          : [],
      };
    default:
      return { champions: [], enemies: [] };
  }
}

function applyEffect(
  state: CardBattleState,
  card: CardDefinition,
  instance: CardInstance,
  effect: CardEffect,
  champion: CardChampion,
  chosenTargetId: string | undefined,
): void {
  const target = effectTarget(effect, card);
  const targets = allEffectTargets(state, target, chosenTargetId);

  if (effect.kind === "damage") {
    let enemies = targets.enemies;
    if (target === "enemy" || target === "randomEnemy") {
      if (!enemies.length) enemies = livingEnemies(state).slice(0, 1);
    }
    if (target === "allEnemies" || target === "enemy" || target === "randomEnemy") {
      for (const enemy of enemies) {
        if (enemy.hp > 0) damageEnemy(state, champion, enemy, effect, card);
      }
    }
    return;
  }

  if (effect.kind === "block") {
    const champs = target === "self" ? [champion] : targets.champions;
    const frail = hasStatus(champion, "frail") ? 0.75 : 1;
    for (const targetChampion of champs) {
      if (targetChampion.hp <= 0) continue;
      targetChampion.block += Math.round(effect.amount * frail);
      addEvent(
        state,
        "block",
        `${targetChampion.name} gains ${Math.round(effect.amount * frail)} block.`,
        targetChampion.petId,
      );
    }
    return;
  }

  if (effect.kind === "heal") {
    const champs = target === "self" ? [champion] : targets.champions;
    for (const targetChampion of champs) {
      if (targetChampion.hp <= 0) continue;
      const amount =
        effect.amount ??
        (effect.basis === "maxHp"
          ? (targetChampion.maxHp * (effect.power ?? 0)) / 100
          : (champion.stats.matk * (effect.power ?? 0)) / 100);
      const healed = healChampion(targetChampion, amount);
      addEvent(state, "heal", `${targetChampion.name} heals ${healed}.`, targetChampion.petId, healed);
    }
    return;
  }

  if (effect.kind === "draw") {
    drawCards(state, effect.amount);
    addEvent(state, "draw", `Draw ${effect.amount}.`);
    return;
  }

  if (effect.kind === "energy") {
    state.energy += effect.amount;
    addEvent(state, "energy", `Gain ${effect.amount} energy.`);
    return;
  }

  if (effect.kind === "status") {
    const chance = effect.chance ?? 1;
    if (chance < 1 && rngFor(state, "status-roll").next() >= chance) {
      addEvent(state, "status", `${effect.status} resisted.`);
      return;
    }
    const turns = effect.turns ?? 2;
    if (target === "self") {
      addStatus(champion, effect.status, effect.stacks, turns);
      addEvent(state, "status", `${champion.name} gains ${effect.status}.`, champion.petId);
      return;
    }
    if (target === "ally" || target === "allAllies") {
      const champs = targets.champions.length ? targets.champions : [champion];
      for (const targetChampion of champs) {
        addStatus(targetChampion, effect.status, effect.stacks, turns);
        addEvent(
          state,
          "status",
          `${targetChampion.name} gains ${effect.status}.`,
          targetChampion.petId,
        );
      }
      return;
    }
    const enemies = targets.enemies.length ? targets.enemies : livingEnemies(state).slice(0, 1);
    for (const enemy of enemies) {
      const poisonBonus =
        effect.status === "poison"
          ? state.relics.reduce(
              (sum, id) => sum + (getRelic(id)?.effect.poisonBonus ?? 0),
              0,
            )
          : 0;
      addStatus(enemy, effect.status, effect.stacks + poisonBonus, turns);
      addEvent(state, "status", `${enemy.name} gains ${effect.status}.`, enemy.id);
    }
  }
}

function effectTarget(effect: CardEffect, card: CardDefinition): string | undefined {
  return "target" in effect ? effect.target : card.target;
}

function chooseIntent(state: CardBattleState, enemy: CardEnemy): EnemyMove {
  const rng = rngFor(state, `intent:${enemy.id}`);
  return enemy.moves[rng.int(0, enemy.moves.length - 1)] ?? { kind: "attack", power: 80 };
}

function executeEnemyMove(state: CardBattleState, enemy: CardEnemy, move: EnemyMove): void {
  state.phase = "enemy";
  if (hasStatus(enemy, "stun")) {
    addEvent(state, "status", `${enemy.name} is stunned.`, enemy.id);
    return;
  }
  if (move.kind === "attack") {
    const champions = livingChampions(state);
    if (!champions.length) return;
    const target = champions[rngFor(state, `enemy-target:${enemy.id}`).int(0, champions.length - 1)];
    damageChampion(state, enemy, target, move.power, move.hits ?? 1);
    return;
  }
  if (move.kind === "block") {
    enemy.block += move.amount;
    addEvent(state, "block", `${enemy.name} gains ${move.amount} block.`, enemy.id);
    return;
  }
  if (move.kind === "buff") {
    addStatus(enemy, move.status, move.stacks, 2);
    addEvent(state, "status", `${enemy.name} gains ${move.status}.`, enemy.id);
    return;
  }
  const champions =
    move.target === "allChampions"
      ? livingChampions(state)
      : [livingChampions(state)[rngFor(state, `enemy-debuff:${enemy.id}`).int(0, Math.max(0, livingChampions(state).length - 1))]];
  for (const champion of champions) {
    if (champion) {
      addStatus(champion, move.status, move.stacks, 2);
      addEvent(state, "status", `${champion.name} gains ${move.status}.`, champion.petId);
    }
  }
}

function enemyTurn(state: CardBattleState): void {
  state.phase = "enemy";
  for (const enemy of livingEnemies(state)) {
    enemy.block = 0;
    executeEnemyMove(state, enemy, enemy.intent);
    if (livingChampions(state).length === 0) return finish(state, "enemy");
  }
  for (const enemy of livingEnemies(state)) {
    if (hasStatus(enemy, "poison")) {
      const damage = statusStacks(enemy, "poison") * 3;
      enemy.hp = Math.max(0, enemy.hp - damage);
      addEvent(state, "poison", `${enemy.name} takes ${damage} poison.`, enemy.id, damage);
    }
    tickStatuses(enemy);
    enemy.intent = chooseIntent(state, enemy);
  }
  for (const champion of state.champions) {
    tickStatuses(champion);
  }
  if (livingEnemies(state).length === 0) {
    finish(state, "player");
    return;
  }
  startPlayerTurn(state);
}

function startPlayerTurn(state: CardBattleState): void {
  state.phase = "player";
  state.turn += 1;
  const firstTurn = state.turn === 1;
  const energyRelic = state.relics.reduce(
    (sum, id) => sum + (getRelic(id)?.effect.energyPerTurn ?? 0),
    0,
  );
  const firstEnergy = firstTurn
    ? state.relics.reduce((sum, id) => sum + (getRelic(id)?.effect.startEnergy ?? 0), 0)
    : 0;
  state.energy = 3 + energyRelic + firstEnergy;
  state.maxEnergy = 3 + energyRelic + firstEnergy;

  const turnBlock = state.relics.reduce(
    (sum, id) => sum + (getRelic(id)?.effect.turnBlock ?? 0),
    0,
  );
  for (const champion of state.champions) {
    champion.block = turnBlock;
  }

  const drawCount =
    5 +
    (firstTurn ? state.relics.reduce((sum, id) => sum + (getRelic(id)?.effect.startDraw ?? 0), 0) : 0) +
    (firstTurn && state.edicts.includes("open-hand") ? 1 : 0) +
    state.relics.reduce((sum, id) => sum + (getRelic(id)?.effect.drawPerTurn ?? 0), 0);
  drawCards(state, drawCount);
  addEvent(state, "turn", `Turn ${state.turn}.`);
}

function finish(state: CardBattleState, winner: "player" | "enemy"): void {
  state.phase = winner === "player" ? "won" : "lost";
  const result: CardBattleResult = {
    winner,
    turns: state.turn,
    checksum: checksum(
      `${state.seed}|${state.turn}|${winner}|${state.champions.map((c) => `${c.petId}:${c.hp}`).join(",")}|${state.enemies.map((e) => `${e.id}:${e.hp}`).join(",")}`,
    ),
  };
  state.result = result;
  addEvent(state, "end", winner === "player" ? "Victory." : "Defeat.");
}

function assertPlayerState(state: CardBattleState): void {
  if (state.phase === "won" || state.phase === "lost") {
    throw new CardRuleError("This battle is already over.", 409);
  }
  if (state.phase !== "player") {
    throw new CardRuleError("It is not the player's turn.", 409);
  }
}

export function createCardBattle(params: {
  seed: string;
  champions: CardChampion[];
  enemies: CardEnemy[];
  deck: CardInstance[];
  relics: string[];
  edicts?: string[];
}): CardBattleState {
  const rng = new Rng(`battle:${params.seed}:running`);
  const shuffled = shuffleInPlace([...params.deck], rng);
  const champions = params.champions.map((champion) => ({
    ...champion,
    block: 0,
    statuses: [],
    hp: Math.min(champion.maxHp, Math.max(1, champion.hp)),
  }));
  const enemies = params.enemies.map((enemy) => ({
    ...enemy,
    block: 0,
    statuses: [],
    hp: enemy.maxHp,
    intent: enemy.moves[0],
  }));
  const state: CardBattleState = {
    seed: params.seed,
    turn: 0,
    phase: "player",
    energy: 3,
    maxEnergy: 3,
    hand: [],
    drawPile: shuffled,
    discardPile: [],
    exhaustPile: [],
    champions,
    enemies,
    relics: [...params.relics],
    edicts: [...(params.edicts ?? [])],
    events: [],
    firstAttackUsed: false,
    secondWindUsed: false,
    rngCounter: 0,
    result: null,
  };

  const startBlock = state.relics.reduce(
    (sum, id) => sum + (getRelic(id)?.effect.startBlock ?? 0),
    0,
  );
  for (const enemy of state.enemies) enemy.intent = chooseIntent(state, enemy);
  startPlayerTurn(state);
  if (startBlock > 0) {
    for (const champion of state.champions) champion.block += startBlock;
  }
  return state;
}

export function applyCardAction(
  input: CardBattleState,
  action: CardAction,
): CardBattleState {
  const state = clone(input);
  assertPlayerState(state);

  if (action.kind === "endTurn") {
    for (const card of state.hand) state.discardPile.push(card);
    state.hand = [];
    for (const champion of state.champions) {
      const poison = statusStacks(champion, "poison") * 3;
      if (poison > 0 && champion.hp > 0) {
        champion.hp = Math.max(0, champion.hp - poison);
        addEvent(state, "poison", `${champion.name} takes ${poison} poison.`, champion.petId, poison);
        if (champion.hp <= 0) exhaustChampionCards(state, champion.petId);
      }
    }
    if (livingChampions(state).length === 0) {
      finish(state, "enemy");
      return state;
    }
    enemyTurn(state);
    return state;
  }

  const index = state.hand.findIndex((card) => card.instanceId === action.instanceId);
  if (index < 0) throw new CardRuleError("Card is not in hand.");
  const instance = state.hand[index];
  const card = definitionFor(instance);
  const champion = cardOwner(state, instance);
  if (!champion || champion.hp <= 0) throw new CardRuleError("That champion is down.");
  if (hasStatus(champion, "stun")) throw new CardRuleError("That champion is stunned.");
  if (state.energy < card.cost) throw new CardRuleError("Not enough energy.");

  const needsEnemy = card.target === "enemy" || card.target === "randomEnemy";
  const needsAlly = card.target === "ally";
  if (needsEnemy && !action.targetId) throw new CardRuleError("Choose an enemy target.");
  if (needsAlly && !action.targetId) throw new CardRuleError("Choose an ally target.");
  if (needsEnemy && action.targetId && !enemyById(state, action.targetId)) {
    throw new CardRuleError("Enemy target is invalid.");
  }
  if (needsAlly && action.targetId && !championById(state, action.targetId)) {
    throw new CardRuleError("Ally target is invalid.");
  }

  state.energy -= card.cost;
  state.hand.splice(index, 1);
  for (const effect of card.effects) {
    applyEffect(state, card, instance, effect, champion, action.targetId);
  }

  if (state.enemies.every((enemy) => enemy.hp <= 0)) {
    finish(state, "player");
  } else if (card.exhaust) {
    state.exhaustPile.push(instance);
  } else {
    state.discardPile.push(instance);
  }
  return state;
}

export function isBattleFinished(state: CardBattleState): boolean {
  return state.phase === "won" || state.phase === "lost";
}

export function battleResult(state: CardBattleState): CardBattleResult {
  if (!state.result) throw new CardRuleError("Battle has not finished.", 409);
  return state.result;
}
