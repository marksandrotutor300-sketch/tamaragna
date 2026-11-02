"use client";

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/client/api";
import { queueCareAction, requestCareSync } from "@/lib/client/care-queue";
import type { PetView } from "@/lib/game/views";
import type { CareAction } from "@/lib/game/types";
import type { QuestSummary } from "@/lib/game/quests";

export type MeResponse = {
  profile: {
    id: string;
    displayName: string;
    coins: number;
    eggs: number;
    food: number;
    rating: number;
    season: number;
    placementMatches: number;
    publicSlug: string | null;
    publicCard: boolean;
    materials: number;
    legacyPoints: number;
    spectatorPoints: number;
    habitat: string;
  };
  pets: PetView[];
  team: string[];
};

export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: () => api.get<MeResponse>("/api/me"),
  });
}

export type AuthSession = {
  authenticated: boolean;
  email: string | null;
  profileId: string;
};

export function useAuthSession() {
  return useQuery({
    queryKey: ["auth"],
    queryFn: () => api.get<AuthSession>("/api/auth/session"),
  });
}

export function useRequestMagicLink() {
  return useMutation({
    mutationFn: (email: string) =>
      api.post<{ ok: boolean; expiresAt: string; devLink?: string }>(
        "/api/auth/magic-link",
        { email },
      ),
  });
}

export function useCareAction() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ petId, action }: { petId: string; action: CareAction }) => {
      try {
        return await api.post<{
          pet: PetView | null;
          coins: number;
          queued?: boolean;
        }>(`/api/pets/${petId}/care`, { action });
      } catch (error) {
        if (
          error instanceof TypeError &&
          typeof navigator !== "undefined" &&
          "serviceWorker" in navigator &&
          !navigator.onLine
        ) {
          await queueCareAction(petId, action);
          await requestCareSync();
          return { pet: null, coins: 0, queued: true };
        }
        throw error;
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useUpdatePet() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      petId,
      patch,
    }: {
      petId: string;
      patch: { nickname?: string; slot?: 1 | 2 | 3 | null; loadout?: number[] };
    }) => api.patch<{ pet: PetView }>(`/api/pets/${petId}`, patch),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useHatch() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { kind: "wild" | "focused"; focusElement?: number }) =>
      api.post<{ pet: PetView; eggs: number }>("/api/hatch", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useBreed() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { parentA: string; parentB: string }) =>
      api.post<{ pet: PetView; eggs: number; coins: number }>("/api/breed", body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useAwaken() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ petId, fodderId }: { petId: string; fodderId: string }) =>
      api.post<{ pet: PetView; coins: number }>(`/api/pets/${petId}/awaken`, { fodderId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useRerollNature() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ petId }: { petId: string }) =>
      api.post<{ pet: PetView; coins: number }>(`/api/pets/${petId}/nature`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useQuests() {
  return useQuery({
    queryKey: ["quests"],
    queryFn: () => api.get<QuestSummary>("/api/quests"),
  });
}

export function useClaimQuest() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: { kind: "daily" | "weekly" | "login"; id?: string }) =>
      api.post<{ reward: { coins: number; eggs: number }; summary: QuestSummary }>(
        "/api/quests/claim",
        body,
      ),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["quests"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useFeatured() {
  return useQuery({
    queryKey: ["featured"],
    queryFn: () =>
      api.get<{
        date: string;
        boost: number;
        species: Array<{
          id: number;
          name: string;
          tier: number;
          element: number;
          elementLevel: number;
          raceName: string;
          mvp: boolean;
          boss: boolean;
        }>;
      }>("/api/featured"),
  });
}

export type SeasonResponse = {
  season: number;
  rating: number;
  placementMatches: number;
  placementsRequired: number;
  tier: { id: string; name: string; min: number; coins: number; eggs: number };
  rewards: Array<{
    season: number;
    rating: number;
    tier: string;
    coins: number;
    eggs: number;
    claimed: boolean;
  }>;
  unclaimed: { coins: number; eggs: number };
};

export function useSeason() {
  return useQuery({
    queryKey: ["season"],
    queryFn: () => api.get<SeasonResponse>("/api/season"),
  });
}

export function useClaimSeason() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => api.post<{ coins: number; eggs: number }>("/api/season/claim"),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["season"] });
      void queryClient.invalidateQueries({ queryKey: ["me"] });
    },
  });
}

export function useCreateTransferCode() {
  return useMutation({
    mutationFn: () =>
      api.post<{ code: string; expiresAt: string }>("/api/account/transfer"),
  });
}

export type EvolutionOption = {
  from: number;
  to: number;
  stage: number;
  level: number;
  star: number;
  coins: number;
  branch: string;
  family: string;
  target: {
    id: number;
    name: string;
    tier: number;
    element: number;
    elementLevel: number;
  };
};

export function useEvolutionOptions(petId: string | null | undefined) {
  return useQuery({
    queryKey: ["evolution", petId],
    queryFn: () =>
      api.get<{ stage: number; options: EvolutionOption[] }>(
        `/api/pets/${petId}/evolution-options`,
      ),
    enabled: Boolean(petId),
  });
}

export function useEvolve() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      petId,
      toSpeciesId,
    }: {
      petId: string;
      toSpeciesId: number;
    }) =>
      api.post<{ pet: PetView; coins: number }>(`/api/pets/${petId}/evolve`, {
        toSpeciesId,
      }),
    onSuccess: (_, variables) => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({
        queryKey: ["evolution", variables.petId],
      });
      void queryClient.invalidateQueries({
        queryKey: ["lineage", variables.petId],
      });
    },
  });
}

export type LineageEntry = {
  id: string;
  nickname: string;
  speciesId: number;
  speciesName: string;
  level: number;
  stage: number;
  depth: number;
};

export function useLineage(petId: string | null | undefined) {
  return useQuery({
    queryKey: ["lineage", petId],
    queryFn: () =>
      api.get<{ ancestors: LineageEntry[] }>(`/api/pets/${petId}/lineage`),
    enabled: Boolean(petId),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (displayName: string) =>
      api.patch<{ displayName: string }>("/api/me", { displayName }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ["me"] });
      void queryClient.invalidateQueries({ queryKey: ["pvp-history"] });
    },
  });
}

export function teamPets(pets: PetView[]): PetView[] {
  return pets
    .filter((pet) => pet.slot !== null)
    .sort((a, b) => (a.slot ?? 99) - (b.slot ?? 99));
}

export function storagePets(pets: PetView[]): PetView[] {
  return pets.filter((pet) => pet.slot === null);
}
