"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Coins, ShoppingBag, Tag, X } from "lucide-react";
import { Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import { PetSprite } from "@/components/pet/PetSprite";
import { RarityBadge } from "@/components/pet/RarityFrame";
import { NatureBadge } from "@/components/pet/Genetics";
import { api } from "@/lib/client/api";
import { useMe } from "@/hooks/useGame";
import type { PetView } from "@/lib/game/views";

type Listing = {
  id: string;
  price: number;
  seller: string;
  sellerId: string;
  createdAt: string;
  pet: PetView;
};

export default function MarketPage() {
  const queryClient = useQueryClient();
  const { data: me } = useMe();
  const { data, isLoading } = useQuery({
    queryKey: ["market"],
    queryFn: () => api.get<{ listings: Listing[] }>("/api/market"),
    refetchInterval: 10_000,
  });
  const [selectedId, setSelectedId] = useState("");
  const [price, setPrice] = useState("500");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const storage = (me?.pets ?? []).filter(
    (pet) => pet.slot === null && !pet.marketListed && !pet.expeditionId,
  );
  const selected = storage.find((pet) => pet.id === selectedId);

  const refresh = async () => {
    await queryClient.invalidateQueries({ queryKey: ["market"] });
    await queryClient.invalidateQueries({ queryKey: ["me"] });
  };

  const list = async () => {
    if (!selected) return;
    setBusy(true);
    setError(null);
    try {
      await api.post("/api/market", {
        petId: selected.id,
        price: Number(price),
      });
      setMessage(`${selected.nickname} listed for ${Number(price).toLocaleString()} coins.`);
      setSelectedId("");
      await refresh();
    } catch (listError) {
      setError(listError instanceof Error ? listError.message : "Could not list pet");
    } finally {
      setBusy(false);
    }
  };

  const buy = async (listing: Listing) => {
    if (!window.confirm(`Buy ${listing.pet.nickname} for ${listing.price.toLocaleString()} coins?`)) return;
    setBusy(true);
    setError(null);
    try {
      await api.post(`/api/market/${listing.id}/buy`);
      setMessage(`${listing.pet.nickname} joined your ranch.`);
      await refresh();
    } catch (buyError) {
      setError(buyError instanceof Error ? buyError.message : "Could not buy pet");
    } finally {
      setBusy(false);
    }
  };

  const cancel = async (listing: Listing) => {
    setBusy(true);
    setError(null);
    try {
      await api.del(`/api/market/${listing.id}`);
      setMessage("Listing cancelled.");
      await refresh();
    } catch (cancelError) {
      setError(cancelError instanceof Error ? cancelError.message : "Could not cancel");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted">economy</div>
        <h1 className="flex items-center gap-2 font-display text-2xl">
          <ShoppingBag className="h-5 w-5 text-gold" /> Auction house
        </h1>
        <p className="mt-1 text-xs text-muted">
          Storage pets only. The house takes a 5% fee on each sale; listings never expose
          your account identity.
        </p>
      </div>

      <Panel>
        <SectionTitle hint={`${storage.length} storage pets`}>List a pet</SectionTitle>
        <div className="grid gap-2 sm:grid-cols-[1fr_140px_auto]">
          <select
            value={selectedId}
            onChange={(event) => setSelectedId(event.target.value)}
            className="rounded-lg border border-line bg-black/30 px-2 py-2 text-xs outline-none focus:border-gold/50"
          >
            <option value="">Choose a storage pet</option>
            {storage.map((pet) => (
              <option key={pet.id} value={pet.id}>
                {pet.nickname} · Lv {pet.level} · {pet.species.name} · {pet.power} power
              </option>
            ))}
          </select>
          <input
            type="number"
            min={100}
            max={1_000_000}
            value={price}
            onChange={(event) => setPrice(event.target.value)}
            className="rounded-lg border border-line bg-black/30 px-2 py-2 text-xs outline-none focus:border-gold/50"
          />
          <Button size="sm" onClick={() => void list()} disabled={busy || !selected}>
            <Tag className="h-3.5 w-3.5" /> List
          </Button>
        </div>
        {selected ? (
          <div className="mt-2 flex items-center gap-2 text-[10px] text-muted">
            <PetSprite speciesId={selected.speciesId} size={30} animate={false} />
            {selected.nickname} · {selected.species.name} · IV{" "}
            {Object.values(selected.ivs).reduce((sum, value) => sum + value, 0)}/186
          </div>
        ) : null}
        {message ? <p className="mt-2 text-[10px] text-teal">{message}</p> : null}
        {error ? <p className="mt-2 text-[10px] text-rose">{error}</p> : null}
      </Panel>

      {isLoading ? (
        <div className="flex h-40 items-center justify-center text-muted">
          <Spinner className="h-6 w-6" />
        </div>
      ) : (
        <div className="grid gap-2 sm:grid-cols-2">
          {data?.listings.map((listing) => (
            <Panel key={listing.id} className="flex gap-3">
              <PetSprite speciesId={listing.pet.speciesId} size={64} animate={false} />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-sm">{listing.pet.nickname}</span>
                  <RarityBadge rarity={listing.pet.rarity} />
                </div>
                <div className="text-[10px] text-muted">
                  Lv {listing.pet.level} · {listing.pet.species.name} ·{" "}
                  {listing.pet.power.toLocaleString()} power
                </div>
                <div className="mt-1 flex flex-wrap gap-1">
                  <NatureBadge nature={listing.pet.nature} />
                  <span className="text-[10px] text-muted">by {listing.seller}</span>
                </div>
                <div className="mt-2 flex items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-1 text-xs text-gold">
                    <Coins className="h-3.5 w-3.5" /> {listing.price.toLocaleString()}
                  </span>
                  {listing.sellerId === me?.profile.id ? (
                    <Button size="sm" variant="ghost" onClick={() => void cancel(listing)} disabled={busy}>
                      <X className="h-3 w-3" /> Cancel
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      onClick={() => void buy(listing)}
                      disabled={busy || (me?.profile.coins ?? 0) < listing.price}
                    >
                      Buy
                    </Button>
                  )}
                </div>
              </div>
            </Panel>
          ))}
          {data?.listings.length === 0 ? (
            <Panel className="py-8 text-center text-xs text-muted sm:col-span-2">
              The auction house is empty. List the first pet.
            </Panel>
          ) : null}
        </div>
      )}
    </div>
  );
}
