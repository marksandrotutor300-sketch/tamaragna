import { Rng } from "@/lib/rng";
import type { CardContractId, CardContractState } from "../types";

export type ContractDefinition = {
  id: CardContractId;
  name: string;
  description: string;
  target: number;
  rewardGold: number;
};

export const CONTRACTS: ContractDefinition[] = [
  {
    id: "hunter",
    name: "Hunter",
    description: "Clear 3 elite or hunt rooms.",
    target: 3,
    rewardGold: 80,
  },
  {
    id: "unbroken",
    name: "Unbroken",
    description: "Win 5 battles without a champion falling.",
    target: 5,
    rewardGold: 100,
  },
  {
    id: "elementalist",
    name: "Elementalist",
    description: "Play 20 cards.",
    target: 20,
    rewardGold: 60,
  },
  {
    id: "deep-dive",
    name: "Deep Dive",
    description: "Complete Act 2.",
    target: 1,
    rewardGold: 90,
  },
  {
    id: "boss-slayer",
    name: "Boss Slayer",
    description: "Defeat 2 act bosses.",
    target: 2,
    rewardGold: 120,
  },
];

const BY_ID = new Map(CONTRACTS.map((contract) => [contract.id, contract]));

export function getContract(id: string): ContractDefinition | undefined {
  return BY_ID.get(id as CardContractId);
}

export function createContracts(seed: string): CardContractState[] {
  const rng = new Rng(`contracts:${seed}`);
  const pool = [...CONTRACTS];
  const chosen: ContractDefinition[] = [];
  while (chosen.length < 3 && pool.length > 0) {
    const index = rng.int(0, pool.length - 1);
    const [contract] = pool.splice(index, 1);
    chosen.push(contract);
  }
  return chosen.map((contract) => ({
    id: contract.id,
    progress: 0,
    completed: false,
    claimed: false,
    rewardGold: contract.rewardGold,
  }));
}

export type ContractEvent =
  | "elite"
  | "hunt"
  | "battle_win"
  | "champion_fell"
  | "card_play"
  | "act2"
  | "boss";

export function advanceContracts(
  contracts: CardContractState[],
  event: ContractEvent,
  amount = 1,
): CardContractState[] {
  return contracts.map((contract) => {
    if (contract.completed || contract.claimed) return contract;
    const definition = getContract(contract.id);
    if (!definition) return contract;
    let progress = contract.progress;
    let failed = contract.failed;

    if (contract.id === "hunter" && (event === "elite" || event === "hunt")) {
      progress += amount;
    }
    if (contract.id === "unbroken") {
      if (event === "champion_fell") failed = true;
      if (event === "battle_win" && !failed) progress += amount;
    }
    if (contract.id === "elementalist" && event === "card_play") progress += amount;
    if (contract.id === "deep-dive" && event === "act2") progress += amount;
    if (contract.id === "boss-slayer" && event === "boss") progress += amount;

    return {
      ...contract,
      progress: failed ? progress : Math.min(definition.target, progress),
      failed,
      completed: !failed && progress >= definition.target,
    };
  });
}
