"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import type {
  CardAction,
  CardBattleView,
  CardRunView,
} from "@/lib/cards/types";
import type { EdictDefinition } from "@/lib/cards/content/edicts";
import type { RiftPathDefinition } from "@/lib/cards/content/paths";

export type CardLeaderboardEntry = {
  rank: number;
  displayName: string;
  score: number;
  act: number;
  rooms: number;
  elapsedMs: number;
};

export type CardHub = {
  activeRun: CardRunView | null;
  best: CardRunView | null;
  teamSize: number;
  canStart: boolean;
  wins: number;
  maxAscension: number;
  riftEssence: number;
  edicts: string[];
  edictDefinitions: EdictDefinition[];
  paths: RiftPathDefinition[];
  leaderboard: CardLeaderboardEntry[];
};

export function useCardHub() {
  return useQuery({
    queryKey: ["card-hub"],
    queryFn: () => api.get<CardHub>("/api/cards"),
  });
}

export function useCardRun(runId: string | null | undefined) {
  return useQuery({
    queryKey: ["card-run", runId],
    queryFn: () => api.get<{ run: CardRunView }>(`/api/cards/runs/${runId}`),
    enabled: Boolean(runId),
  });
}

export function useCardBattle(battleId: string | null | undefined) {
  return useQuery({
    queryKey: ["card-battle", battleId],
    queryFn: () => api.get<{ battle: CardBattleView }>(`/api/cards/battles/${battleId}`),
    enabled: Boolean(battleId),
    staleTime: 0,
  });
}

function useCardInvalidation() {
  const queryClient = useQueryClient();
  return () => {
    void queryClient.invalidateQueries({ queryKey: ["card-hub"] });
    void queryClient.invalidateQueries({ queryKey: ["card-run"] });
    void queryClient.invalidateQueries({ queryKey: ["me"] });
  };
}

export function useStartCardRun() {
  const invalidate = useCardInvalidation();
  return useMutation({
    mutationFn: (input?: { ascension?: number; path?: string }) =>
      api.post<{ run: CardRunView }>("/api/cards/runs", input ?? {}),
    onSuccess: invalidate,
  });
}

export function useEnterCardNode(runId: string) {
  const invalidate = useCardInvalidation();
  return useMutation({
    mutationFn: (nodeId: string) =>
      api.post<{ run: CardRunView; battle: CardBattleView | null }>(
        `/api/cards/runs/${runId}/enter`,
        { nodeId },
      ),
    onSuccess: invalidate,
  });
}

export function useCardAction(battleId: string, runId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { version: number; action: CardAction }) =>
      api.post<{
        battle: CardBattleView;
        run: CardRunView;
        reward: { coins: number; materials: number; eggs: number; xp: number } | null;
      }>(`/api/cards/battles/${battleId}/action`, input),
    onSuccess: (data) => {
      queryClient.setQueryData(["card-battle", battleId], { battle: data.battle });
      queryClient.setQueryData(["card-run", runId], { run: data.run });
      void queryClient.invalidateQueries({ queryKey: ["card-hub"] });
    },
  });
}

export function useClaimCardReward(runId: string) {
  const invalidate = useCardInvalidation();
  return useMutation({
    mutationFn: (body: { choice: "card" | "relic" | "skip"; id?: string }) =>
      api.post<{ run: CardRunView }>(`/api/cards/runs/${runId}/reward`, body),
    onSuccess: invalidate,
  });
}

export function useRestCardRun(runId: string) {
  const invalidate = useCardInvalidation();
  return useMutation({
    mutationFn: (body: { choice: "heal" | "upgrade" | "signature" | "ascend"; instanceId?: string; petId?: string }) =>
      api.post<{ run: CardRunView }>(`/api/cards/runs/${runId}/rest`, body),
    onSuccess: invalidate,
  });
}

export function useShopCardRun(runId: string) {
  const invalidate = useCardInvalidation();
  return useMutation({
    mutationFn: (
      body:
        | { action: "leave" }
        | { action: "buy"; kind: "card" | "relic"; id: string }
        | { action: "remove"; instanceId: string }
        | { action: "evolve"; relicId: string }
        | { action: "inscribe"; instanceId: string; runeId: string },
    ) => api.post<{ run: CardRunView }>(`/api/cards/runs/${runId}/shop`, body),
    onSuccess: invalidate,
  });
}

export function usePurchaseEdict() {
  const invalidate = useCardInvalidation();
  return useMutation({
    mutationFn: (id: string) =>
      api.post<{ essence: number; edicts: string[] }>("/api/cards/edicts", { id }),
    onSuccess: invalidate,
  });
}

export function useClaimContract(runId: string) {
  const invalidate = useCardInvalidation();
  return useMutation({
    mutationFn: (contractId: string) =>
      api.post<{ run: CardRunView }>(`/api/cards/runs/${runId}/contracts`, { contractId }),
    onSuccess: invalidate,
  });
}

export function useCardEvent(runId: string) {
  const invalidate = useCardInvalidation();
  return useMutation({
    mutationFn: (choiceId: string) =>
      api.post<{ run: CardRunView }>(`/api/cards/runs/${runId}/event`, { choiceId }),
    onSuccess: invalidate,
  });
}

export function useAbandonCardRun(runId: string) {
  const invalidate = useCardInvalidation();
  return useMutation({
    mutationFn: () => api.post<{ run: CardRunView }>(`/api/cards/runs/${runId}/abandon`),
    onSuccess: invalidate,
  });
}
