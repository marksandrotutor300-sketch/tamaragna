import { Rng } from "@/lib/rng";
import type { CardActMap, CardMap, CardNode, CardNodeType, CardRunData } from "./types";

export const ACTS = [
  { act: 1, name: "Verdant Rift", floors: 10 },
  { act: 2, name: "Ember Rift", floors: 11 },
  { act: 3, name: "Astral Rift", floors: 12 },
] as const;

const NODE_LABEL: Record<CardNodeType, string> = {
  battle: "Skirmish",
  elite: "Elite",
  event: "Event",
  rest: "Rest",
  shop: "Shop",
  treasure: "Treasure",
  boss: "Boss",
};

export function nodeLabel(type: CardNodeType): string {
  return NODE_LABEL[type];
}

function nodeTypeForFloor(floor: number, lastFloor: number, rng: Rng): CardNodeType {
  if (floor === 0) return "battle";
  if (floor === lastFloor) return "boss";
  if (floor === lastFloor - 1) return "rest";
  if (floor === 4) return rng.chance(0.55) ? "elite" : "battle";
  if (floor === 7) return rng.chance(0.6) ? "shop" : "event";
  const roll = rng.next();
  if (roll < 0.46) return "battle";
  if (roll < 0.58) return "event";
  if (roll < 0.69) return "elite";
  if (roll < 0.82) return "treasure";
  return "battle";
}

function generateAct(seed: string, act: (typeof ACTS)[number]): CardActMap {
  const rng = new Rng(`map:${seed}:${act.act}`);
  const lastFloor = act.floors - 1;
  const floors: CardNode[][] = [];

  for (let floor = 0; floor <= lastFloor; floor += 1) {
    const count = floor === 0 || floor === lastFloor ? 1 : rng.int(2, 3);
    const nodes: CardNode[] = [];
    for (let row = 0; row < count; row += 1) {
      nodes.push({
        id: `a${act.act}-f${floor}-n${row}`,
        act: act.act,
        floor,
        type: nodeTypeForFloor(floor, lastFloor, rng),
        next: [],
      });
    }
    floors.push(nodes);
  }

  for (let floor = 0; floor < lastFloor; floor += 1) {
    const current = floors[floor];
    const next = floors[floor + 1];
    for (const node of current) {
      // Keep each floor connected while retaining a real choice.
      node.next = next.map((entry) => entry.id);
    }
  }

  return {
    act: act.act,
    name: act.name,
    nodes: floors.flat(),
  };
}

export function generateRunMap(seed: string): CardMap {
  return {
    acts: ACTS.map((act) => generateAct(seed, act)),
  };
}

export function allMapNodes(map: CardMap): CardNode[] {
  return map.acts.flatMap((act) => act.nodes);
}

export function nodeById(map: CardMap, nodeId: string | null): CardNode | null {
  if (!nodeId) return null;
  return allMapNodes(map).find((node) => node.id === nodeId) ?? null;
}

export function actStartNode(map: CardMap, act: number): CardNode | null {
  return map.acts.find((entry) => entry.act === act)?.nodes.find((node) => node.floor === 0) ?? null;
}

export function availableNodes(
  run: Pick<CardRunData, "map" | "nodeId" | "completedNodeIds" | "act" | "status">,
): CardNode[] {
  if (run.status !== "active") return [];
  const current = nodeById(run.map, run.nodeId);
  const completed = new Set(run.completedNodeIds);
  if (!current) {
    const start = actStartNode(run.map, run.act);
    return start ? [start] : [];
  }
  return current.next
    .map((id) => nodeById(run.map, id))
    .filter((node): node is CardNode => Boolean(node))
    .filter((node) => !completed.has(node.id));
}

export function isNodeReachable(
  run: Pick<CardRunData, "map" | "nodeId" | "completedNodeIds" | "act" | "status">,
  nodeId: string,
): boolean {
  return availableNodes(run).some((node) => node.id === nodeId);
}

export function nextAct(map: CardMap, act: number): CardActMap | null {
  return map.acts.find((entry) => entry.act === act + 1) ?? null;
}

export function runActName(map: CardMap, act: number): string {
  return map.acts.find((entry) => entry.act === act)?.name ?? `Act ${act}`;
}
