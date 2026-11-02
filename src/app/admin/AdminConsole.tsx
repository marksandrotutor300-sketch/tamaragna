"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Crown,
  Gift,
  Pencil,
  Plus,
  ScrollText,
  Search,
  ShieldCheck,
  Sparkles,
  Undo2,
  UserMinus,
  Wallet,
} from "lucide-react";
import { Button, EmptyState, Panel, Pill, SectionTitle } from "@/components/ui/primitives";
import type { AdminRole } from "@/lib/db/schema";

type Player = {
  id: string;
  displayName: string;
  publicSlug: string | null;
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

type Ivs = { str: number; agi: number; vit: number; int: number; dex: number; luk: number };

type Pet = {
  id: string;
  speciesId: number;
  nickname: string;
  rarity: number;
  level: number;
  exp: number;
  star: number;
  nature: string;
  evolutionStage: number;
  ivs: Ivs;
  power: number;
  stats: Record<string, number>;
  statOverrides: Record<string, number> | null;
  species: { name: string };
};

type PlayerDetail = Player & { pets: Pet[] };

type Species = { id: number; name: string; tier: number; level: number };

type AuditEntry = {
  id: string;
  actorLabel: string;
  action: string;
  targetProfileId: string | null;
  targetPetId: string | null;
  createdAt: string;
};

type RoleAccount = {
  id: string;
  email: string;
  role: AdminRole | null;
  createdAt: string;
};

type RoleEvent = {
  id: string;
  actorLabel: string;
  targetEmail: string;
  action: string;
  previousRole: AdminRole | null;
  newRole: AdminRole | null;
  reason: string;
  createdAt: string;
};

const IV_KEYS = ["str", "agi", "vit", "int", "dex", "luk"] as const;
const NATURES = ["hardy", "brave", "bold", "timid", "modest", "calm", "jolly", "adamant"];
const OVERRIDE_FIELDS: Array<[string, string]> = [
  ["hpMax", "HP"],
  ["atk", "ATK"],
  ["matk", "MATK"],
  ["def", "DEF"],
  ["mdef", "MDEF"],
  ["aspdMs", "ASPD (ms)"],
  ["critChance", "Crit chance"],
  ["critMult", "Crit mult"],
  ["statusResist", "Status resist"],
];

const inputClass =
  "rounded-lg border border-line bg-black/30 px-2 py-2 text-xs outline-none focus:border-teal/50";
const labelClass = "text-[10px] uppercase tracking-[0.15em] text-muted";

const emptyIvs = (value: string): Record<string, string> =>
  Object.fromEntries(IV_KEYS.map((key) => [key, value]));

const emptyOverrides = (): Record<string, string> =>
  Object.fromEntries(OVERRIDE_FIELDS.map(([key]) => [key, ""]));

function toNumber(value: string): number | undefined {
  if (!value.trim()) return undefined;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function overridesFromState(state: Record<string, string>): Record<string, number> | null {
  const out: Record<string, number> = {};
  for (const [key] of OVERRIDE_FIELDS) {
    const value = toNumber(state[key] ?? "");
    if (value !== undefined) out[key] = value;
  }
  return Object.keys(out).length > 0 ? out : null;
}

export function AdminConsole({
  initialToken,
  actor,
  via,
  role,
}: {
  initialToken: string;
  actor: string;
  via: "token" | "session";
  role: AdminRole;
}) {
  const [token, setToken] = useState(initialToken);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [query, setQuery] = useState("");
  const [players, setPlayers] = useState<Player[]>([]);
  const [detail, setDetail] = useState<PlayerDetail | null>(null);

  const [wallet, setWallet] = useState<Record<string, string>>({});
  const [audit, setAudit] = useState<AuditEntry[]>([]);
  const [accounts, setAccounts] = useState<RoleAccount[]>([]);
  const [roleEvents, setRoleEvents] = useState<RoleEvent[]>([]);
  const [grantEmail, setGrantEmail] = useState("");
  const [ownerEmail, setOwnerEmail] = useState("");
  const [roleReason, setRoleReason] = useState("");

  const [speciesQuery, setSpeciesQuery] = useState("");
  const [speciesResults, setSpeciesResults] = useState<Species[]>([]);
  const [generate, setGenerate] = useState({
    speciesId: "",
    nickname: "",
    rarity: "3",
    nature: "hardy",
    level: "1",
    exp: "0",
    star: "1",
  });
  const [genIvs, setGenIvs] = useState<Record<string, string>>(emptyIvs("31"));
  const [genOverrides, setGenOverrides] = useState<Record<string, string>>(emptyOverrides());

  const [editPet, setEditPet] = useState<Pet | null>(null);
  const [edit, setEdit] = useState({
    nickname: "",
    level: "1",
    exp: "0",
    rarity: "1",
    nature: "hardy",
    star: "1",
    evolutionStage: "1",
  });
  const [editIvs, setEditIvs] = useState<Record<string, string>>(emptyIvs("0"));
  const [editOverrides, setEditOverrides] = useState<Record<string, string>>(emptyOverrides());

  const [giftPetId, setGiftPetId] = useState("");
  const [giftQuery, setGiftQuery] = useState("");
  const [giftPlayers, setGiftPlayers] = useState<Player[]>([]);
  const [giftTarget, setGiftTarget] = useState<Player | null>(null);

  const request = useCallback(
    async <T,>(path: string, init?: RequestInit): Promise<T> => {
      const headers = new Headers(init?.headers);
      if (init?.body) headers.set("Content-Type", "application/json");
      if (token) headers.set("x-admin-token", token);

      const response = await fetch(path, { ...init, headers });
      const body = (await response.json().catch(() => ({}))) as {
        error?: string;
      } & T;
      if (!response.ok) throw new Error(body.error ?? "Request failed");
      return body;
    },
    [token],
  );

  const run = useCallback(
    async (task: () => Promise<void>) => {
      setBusy(true);
      setError("");
      try {
        await task();
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : "Request failed");
      } finally {
        setBusy(false);
      }
    },
    [],
  );

  const refreshAudit = useCallback(async () => {
    try {
      const body = await request<{ entries: AuditEntry[] }>("/api/admin/audit");
      setAudit(body.entries);
    } catch {
      setAudit([]);
    }
  }, [request]);

  const refreshRoles = useCallback(async () => {
    try {
      const body = await request<{ accounts: RoleAccount[]; events: RoleEvent[] }>(
        "/api/admin/roles",
      );
      setAccounts(body.accounts);
      setRoleEvents(body.events);
    } catch {
      setAccounts([]);
      setRoleEvents([]);
    }
  }, [request]);

  useEffect(() => {
    void refreshAudit();
    void refreshRoles();
  }, [refreshAudit, refreshRoles]);

  const grantRole = () =>
    run(async () => {
      if (!grantEmail.trim()) throw new Error("Enter the account email");
      const body = await request<{ account: RoleAccount }>("/api/admin/roles", {
        method: "POST",
        body: JSON.stringify({ email: grantEmail.trim(), reason: roleReason.trim() }),
      });
      setNotice(`${body.account.email} is now an admin.`);
      setGrantEmail("");
      await refreshRoles();
    });

  const revokeRole = (account: RoleAccount) => {
    if (!window.confirm(`Revoke admin access for ${account.email}?`)) return;
    void run(async () => {
      await request(`/api/admin/roles/${account.id}/revoke`, {
        method: "POST",
        body: JSON.stringify({ reason: roleReason.trim() }),
      });
      setNotice(`Revoked admin access for ${account.email}.`);
      await refreshRoles();
    });
  };

  const rollbackAccountRole = (account: RoleAccount) => {
    if (!window.confirm(`Roll back the last role change for ${account.email}?`)) return;
    void run(async () => {
      const body = await request<{ account: RoleAccount }>(
        `/api/admin/roles/${account.id}/rollback`,
        {
          method: "POST",
          body: JSON.stringify({ reason: roleReason.trim() }),
        },
      );
      setNotice(
        `Rolled ${account.email} back to ${body.account.role ?? "no admin role"}.`,
      );
      await refreshRoles();
    });
  };

  const transferOwnerRole = () => {
    if (!ownerEmail.trim()) return;
    if (!window.confirm(`Transfer owner to ${ownerEmail.trim()}? You will become an admin.`)) return;
    void run(async () => {
      await request("/api/admin/roles/owner", {
        method: "POST",
        body: JSON.stringify({ email: ownerEmail.trim(), reason: roleReason.trim() }),
      });
      setNotice(`Owner transferred to ${ownerEmail.trim()}.`);
      setOwnerEmail("");
      await refreshRoles();
    });
  };

  const search = () =>
    run(async () => {
      const body = await request<{ players: Player[] }>(
        `/api/admin/players?q=${encodeURIComponent(query)}`,
      );
      setPlayers(body.players);
      setNotice(`${body.players.length} player(s) found`);
    });

  const openPlayer = (id: string) =>
    run(async () => {
      const body = await request<{ player: PlayerDetail }>(`/api/admin/players/${id}`);
      setDetail(body.player);
      setWallet({
        displayName: body.player.displayName,
        coins: String(body.player.coins),
        eggs: String(body.player.eggs),
        food: String(body.player.food),
        materials: String(body.player.materials),
        legacyPoints: String(body.player.legacyPoints),
        spectatorPoints: String(body.player.spectatorPoints),
      });
    });

  const saveWallet = () =>
    run(async () => {
      if (!detail) throw new Error("Pick a player first");
      const body = await request<{ player: Player }>(`/api/admin/players/${detail.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          displayName: wallet.displayName?.trim() || undefined,
          coins: toNumber(wallet.coins ?? ""),
          eggs: toNumber(wallet.eggs ?? ""),
          food: toNumber(wallet.food ?? ""),
          materials: toNumber(wallet.materials ?? ""),
          legacyPoints: toNumber(wallet.legacyPoints ?? ""),
          spectatorPoints: toNumber(wallet.spectatorPoints ?? ""),
        }),
      });
      setNotice(`Saved wallet for ${body.player.displayName}`);
      await openPlayer(detail.id);
      await refreshAudit();
    });

  const searchSpecies = () =>
    run(async () => {
      const body = await request<{ species: Species[] }>(
        `/api/admin/species?q=${encodeURIComponent(speciesQuery)}`,
      );
      setSpeciesResults(body.species);
    });

  const generatePet = (mode: "custom" | "random") =>
    run(async () => {
      if (!detail) throw new Error("Pick a player first");
      const ivs = Object.fromEntries(
        IV_KEYS.map((key) => [key, toNumber(genIvs[key] ?? "") ?? 0]),
      );
      const body = await request<{ pet: Pet }>("/api/admin/pets", {
        method: "POST",
        body: JSON.stringify({
          profileId: detail.id,
          mode,
          speciesId: mode === "custom" ? toNumber(generate.speciesId) : undefined,
          nickname: generate.nickname.trim() || undefined,
          rarity: toNumber(generate.rarity),
          nature: generate.nature,
          level: toNumber(generate.level),
          exp: toNumber(generate.exp),
          star: toNumber(generate.star),
          ivs: mode === "custom" ? ivs : undefined,
          statOverrides: overridesFromState(genOverrides),
        }),
      });
      setNotice(`Created ${body.pet.species.name} (#${body.pet.speciesId})`);
      await openPlayer(detail.id);
      await refreshAudit();
    });

  const pickEdit = (pet: Pet) => {
    setEditPet(pet);
    setEdit({
      nickname: pet.nickname,
      level: String(pet.level),
      exp: String(pet.exp),
      rarity: String(pet.rarity),
      nature: pet.nature,
      star: String(pet.star),
      evolutionStage: String(pet.evolutionStage),
    });
    setEditIvs(
      Object.fromEntries(IV_KEYS.map((key) => [key, String(pet.ivs[key] ?? 0)])),
    );
    setEditOverrides(
      Object.fromEntries(
        OVERRIDE_FIELDS.map(([key]) => [
          key,
          pet.statOverrides?.[key] !== undefined ? String(pet.statOverrides[key]) : "",
        ]),
      ),
    );
  };

  const savePet = () =>
    run(async () => {
      if (!editPet) throw new Error("Pick a pet first");
      const body = await request<{ pet: Pet }>(`/api/admin/pets/${editPet.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          nickname: edit.nickname.trim(),
          level: toNumber(edit.level),
          exp: toNumber(edit.exp),
          rarity: toNumber(edit.rarity),
          nature: edit.nature,
          star: toNumber(edit.star),
          evolutionStage: toNumber(edit.evolutionStage),
          ivs: Object.fromEntries(
            IV_KEYS.map((key) => [key, toNumber(editIvs[key] ?? "") ?? 0]),
          ),
          statOverrides: overridesFromState(editOverrides),
        }),
      });
      setEditPet(body.pet);
      setNotice(`Updated ${body.pet.nickname}`);
      if (detail) await openPlayer(detail.id);
      await refreshAudit();
    });

  const searchGiftTargets = () =>
    run(async () => {
      const body = await request<{ players: Player[] }>(
        `/api/admin/players?q=${encodeURIComponent(giftQuery)}`,
      );
      setGiftPlayers(body.players);
    });

  const giftPet = () =>
    run(async () => {
      if (!giftPetId.trim()) throw new Error("Enter a pet id");
      if (!giftTarget) throw new Error("Pick a target player");
      const body = await request<{ pet: Pet }>(
        `/api/admin/pets/${giftPetId.trim()}/transfer`,
        {
          method: "POST",
          body: JSON.stringify({ toProfileId: giftTarget.id }),
        },
      );
      setNotice(`Gifted ${body.pet.nickname} to ${giftTarget.displayName}`);
      setGiftPetId("");
      await refreshAudit();
      if (detail) await openPlayer(detail.id);
    });

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted">
        super admin
      </div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl">Admin console</h1>
          <p className="mt-1 text-xs text-muted">
            Signed in as {actor} ({via}, {role}). Generate pets, edit stats, gift pets and
            adjust wallets. Every action is written to the audit log.
          </p>
        </div>
        <a
          href={`/admin/balance${token ? `?token=${encodeURIComponent(token)}` : ""}`}
          className="rounded-lg border border-line px-3 py-2 text-[11px] text-muted transition hover:border-teal/40 hover:text-teal"
        >
          Balance telemetry
        </a>
      </div>

      {via === "token" ? (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <span className={labelClass}>ADMIN_TOKEN</span>
          <input
            type="password"
            value={token}
            onChange={(event) => setToken(event.target.value)}
            placeholder="token"
            className={`${inputClass} w-64`}
          />
        </div>
      ) : null}

      {error ? <p className="mt-3 text-[11px] text-rose">{error}</p> : null}
      {notice ? <p className="mt-3 text-[11px] text-teal">{notice}</p> : null}

      <div className="mt-6 grid gap-4">
        <Panel>
          <SectionTitle hint={`${role} access`}>
            <span className="inline-flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-gold" /> Admin roles
            </span>
          </SectionTitle>
          {role === "owner" ? (
            <>
              <p className="mt-1 text-[11px] text-muted">
                Grant admin access by account email. The account must have signed in with a
                magic link once. Owners can revoke or roll back any admin, and every change is
                logged for both accounts.
              </p>
              <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
                <label className="grid gap-1">
                  <span className={labelClass}>Account email</span>
                  <input
                    value={grantEmail}
                    onChange={(event) => setGrantEmail(event.target.value)}
                    placeholder="admin@example.com"
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1">
                  <span className={labelClass}>Reason (optional)</span>
                  <input
                    value={roleReason}
                    onChange={(event) => setRoleReason(event.target.value)}
                    placeholder="why this change?"
                    className={inputClass}
                  />
                </label>
                <Button
                  size="sm"
                  onClick={() => void grantRole()}
                  disabled={busy || !grantEmail.trim()}
                >
                  <Plus className="h-3.5 w-3.5" /> Grant admin
                </Button>
              </div>

              <div className="mt-3 space-y-1">
                {accounts.map((account) => (
                  <div
                    key={account.id}
                    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-line/60 bg-black/20 px-2 py-1.5 text-xs"
                  >
                    <span className="flex min-w-0 items-center gap-2">
                      {account.role === "owner" ? (
                        <Crown className="h-3.5 w-3.5 text-gold" />
                      ) : account.role === "admin" ? (
                        <ShieldCheck className="h-3.5 w-3.5 text-teal" />
                      ) : null}
                      <span className="truncate">{account.email}</span>
                      <Pill>{account.role ?? "none"}</Pill>
                    </span>
                    {account.role === "admin" ? (
                      <span className="flex gap-1">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => rollbackAccountRole(account)}
                          disabled={busy}
                        >
                          <Undo2 className="h-3 w-3" /> Rollback
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => revokeRole(account)}
                          disabled={busy}
                        >
                          <UserMinus className="h-3 w-3" /> Revoke
                        </Button>
                      </span>
                    ) : null}
                  </div>
                ))}
              </div>

              <div className="mt-4 border-t border-line/40 pt-3">
                <div className="text-[10px] uppercase tracking-[0.15em] text-muted">
                  transfer ownership
                </div>
                <p className="mt-1 text-[10px] text-muted">
                  This makes the target the single owner and demotes you to admin. Only do this
                  from the account or token you want to hand off.
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <input
                    value={ownerEmail}
                    onChange={(event) => setOwnerEmail(event.target.value)}
                    placeholder="new-owner@example.com"
                    className={`${inputClass} w-64`}
                  />
                  <Button
                    size="sm"
                    variant="gold"
                    onClick={() => transferOwnerRole()}
                    disabled={busy || !ownerEmail.trim()}
                  >
                    <Crown className="h-3.5 w-3.5" /> Transfer owner
                  </Button>
                </div>
              </div>
            </>
          ) : (
            <p className="mt-1 text-[11px] text-muted">
              You have admin access. Only the owner can grant, revoke or roll back admin roles.
              Your access history is shown below.
            </p>
          )}

          <div className="mt-4">
            <div className="text-[10px] uppercase tracking-[0.15em] text-muted">
              role event log
            </div>
            <div className="mt-2 overflow-x-auto">
              <table className="w-full text-left text-[11px]">
                <thead className="text-muted">
                  <tr>
                    <th className="py-1">When</th>
                    <th className="py-1">Actor</th>
                    <th className="py-1">Target</th>
                    <th className="py-1">Change</th>
                  </tr>
                </thead>
                <tbody>
                  {roleEvents.map((event) => (
                    <tr key={event.id} className="border-t border-line/40">
                      <td className="py-1 tabular-nums text-muted">
                        {new Date(event.createdAt).toLocaleString()}
                      </td>
                      <td className="py-1">{event.actorLabel}</td>
                      <td className="py-1">{event.targetEmail}</td>
                      <td className="py-1">
                        {event.action} · {event.previousRole ?? "none"} →{" "}
                        {event.newRole ?? "none"}
                        {event.reason ? <span className="text-muted"> · {event.reason}</span> : null}
                      </td>
                    </tr>
                  ))}
                  {roleEvents.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="py-3 text-muted">
                        No role changes yet.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </Panel>

        <Panel>
          <SectionTitle hint="search by slug, name or profile id">Find player</SectionTitle>
          <div className="mt-2 flex gap-2">
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter") void search();
              }}
              placeholder="Trainer name, slug or uuid"
              className={`${inputClass} flex-1`}
            />
            <Button size="sm" onClick={() => void search()} disabled={busy || !query.trim()}>
              <Search className="h-3.5 w-3.5" /> Search
            </Button>
          </div>
          {players.length > 0 ? (
            <ul className="mt-3 divide-y divide-line/40 text-[11px]">
              {players.map((player) => (
                <li key={player.id} className="flex items-center justify-between gap-3 py-2">
                  <button
                    className="text-left hover:text-teal"
                    onClick={() => void openPlayer(player.id)}
                  >
                    <span className="font-medium">{player.displayName}</span>
                    <span className="ml-2 text-muted">
                      {player.publicSlug ? `/${player.publicSlug}` : player.id.slice(0, 8)}
                    </span>
                    <span className="ml-2 text-muted">
                      {player.petCount}/30 pets · {player.coins} coins
                    </span>
                  </button>
                  <Pill>select</Pill>
                </li>
              ))}
            </ul>
          ) : null}
        </Panel>

        {detail ? (
          <>
            <Panel>
              <SectionTitle hint={`${detail.petCount}/30 pets`}>
                {detail.displayName}
              </SectionTitle>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                {[
                  ["coins", "Coins"],
                  ["eggs", "Eggs"],
                  ["food", "Food"],
                  ["materials", "Materials"],
                  ["legacyPoints", "Legacy"],
                  ["spectatorPoints", "Spectator"],
                ].map(([key, label]) => (
                  <label key={key} className="grid gap-1">
                    <span className={labelClass}>{label}</span>
                    <input
                      value={wallet[key] ?? ""}
                      onChange={(event) =>
                        setWallet((current) => ({ ...current, [key]: event.target.value }))
                      }
                      className={inputClass}
                    />
                  </label>
                ))}
                <label className="grid gap-1 sm:col-span-2">
                  <span className={labelClass}>Display name</span>
                  <input
                    value={wallet.displayName ?? ""}
                    onChange={(event) =>
                      setWallet((current) => ({ ...current, displayName: event.target.value }))
                    }
                    className={inputClass}
                  />
                </label>
              </div>
              <div className="mt-3">
                <Button size="sm" onClick={() => void saveWallet()} disabled={busy}>
                  <Wallet className="h-3.5 w-3.5" /> Save wallet
                </Button>
              </div>
            </Panel>

            <Panel>
              <SectionTitle hint="custom or random roll">Generate pet</SectionTitle>
              <div className="mt-2 grid gap-2 sm:grid-cols-4">
                <label className="grid gap-1 sm:col-span-2">
                  <span className={labelClass}>Species</span>
                  <div className="flex gap-1">
                    <input
                      value={speciesQuery}
                      onChange={(event) => setSpeciesQuery(event.target.value)}
                      placeholder="Name or id"
                      className={`${inputClass} flex-1`}
                    />
                    <Button size="sm" variant="ghost" onClick={() => void searchSpecies()} disabled={busy}>
                      <Search className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <span className="text-[10px] text-muted">
                    selected: {generate.speciesId || "random"}
                  </span>
                </label>
                <label className="grid gap-1">
                  <span className={labelClass}>Nickname</span>
                  <input
                    value={generate.nickname}
                    onChange={(event) =>
                      setGenerate((current) => ({ ...current, nickname: event.target.value }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1">
                  <span className={labelClass}>Rarity</span>
                  <input
                    value={generate.rarity}
                    onChange={(event) =>
                      setGenerate((current) => ({ ...current, rarity: event.target.value }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1">
                  <span className={labelClass}>Nature</span>
                  <select
                    value={generate.nature}
                    onChange={(event) =>
                      setGenerate((current) => ({ ...current, nature: event.target.value }))
                    }
                    className={inputClass}
                  >
                    {NATURES.map((nature) => (
                      <option key={nature} value={nature}>
                        {nature}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="grid gap-1">
                  <span className={labelClass}>Level</span>
                  <input
                    value={generate.level}
                    onChange={(event) =>
                      setGenerate((current) => ({ ...current, level: event.target.value }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1">
                  <span className={labelClass}>Stars</span>
                  <input
                    value={generate.star}
                    onChange={(event) =>
                      setGenerate((current) => ({ ...current, star: event.target.value }))
                    }
                    className={inputClass}
                  />
                </label>
                <label className="grid gap-1">
                  <span className={labelClass}>Exp</span>
                  <input
                    value={generate.exp}
                    onChange={(event) =>
                      setGenerate((current) => ({ ...current, exp: event.target.value }))
                    }
                    className={inputClass}
                  />
                </label>
              </div>

              {speciesResults.length > 0 ? (
                <div className="mt-2 flex flex-wrap gap-1">
                  {speciesResults.map((species) => (
                    <button
                      key={species.id}
                      onClick={() => {
                        setGenerate((current) => ({
                          ...current,
                          speciesId: String(species.id),
                        }));
                        setSpeciesResults([]);
                      }}
                      className="rounded-full border border-line px-2 py-1 text-[10px] hover:border-teal/50"
                    >
                      {species.name} #{species.id}
                    </button>
                  ))}
                </div>
              ) : null}

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-6">
                {IV_KEYS.map((key) => (
                  <label key={key} className="grid gap-1">
                    <span className={labelClass}>IV {key}</span>
                    <input
                      value={genIvs[key]}
                      onChange={(event) =>
                        setGenIvs((current) => ({ ...current, [key]: event.target.value }))
                      }
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {OVERRIDE_FIELDS.map(([key, label]) => (
                  <label key={key} className="grid gap-1">
                    <span className={labelClass}>override {label}</span>
                    <input
                      value={genOverrides[key] ?? ""}
                      placeholder="auto"
                      onChange={(event) =>
                        setGenOverrides((current) => ({ ...current, [key]: event.target.value }))
                      }
                      className={inputClass}
                    />
                  </label>
                ))}
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                <Button size="sm" onClick={() => void generatePet("custom")} disabled={busy}>
                  <Plus className="h-3.5 w-3.5" /> Generate custom
                </Button>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => void generatePet("random")}
                  disabled={busy}
                >
                  <Sparkles className="h-3.5 w-3.5" /> Random roll
                </Button>
              </div>
            </Panel>

            <Panel>
              <SectionTitle hint="stored inputs + final overrides">Edit pet</SectionTitle>
              {detail.pets.length === 0 ? (
                <EmptyState title="No pets" body="This ranch is empty — generate one above." />
              ) : (
                <div className="mt-2 flex flex-wrap gap-1">
                  {detail.pets.map((pet) => (
                    <button
                      key={pet.id}
                      onClick={() => pickEdit(pet)}
                      className={`rounded-full border px-2 py-1 text-[10px] ${
                        editPet?.id === pet.id
                          ? "border-teal/60 text-teal"
                          : "border-line hover:border-teal/50"
                      }`}
                    >
                      {pet.nickname} · L{pet.level} · {pet.rarity}★
                    </button>
                  ))}
                </div>
              )}

              {editPet ? (
                <>
                  <div className="mt-3 grid gap-2 sm:grid-cols-4">
                    <label className="grid gap-1 sm:col-span-2">
                      <span className={labelClass}>Nickname</span>
                      <input
                        value={edit.nickname}
                        onChange={(event) =>
                          setEdit((current) => ({ ...current, nickname: event.target.value }))
                        }
                        className={inputClass}
                      />
                    </label>
                    {[
                      ["level", "Level"],
                      ["exp", "Exp"],
                      ["rarity", "Rarity"],
                      ["star", "Stars"],
                      ["evolutionStage", "Stage"],
                    ].map(([key, label]) => (
                      <label key={key} className="grid gap-1">
                        <span className={labelClass}>{label}</span>
                        <input
                          value={edit[key as keyof typeof edit]}
                          onChange={(event) =>
                            setEdit((current) => ({ ...current, [key]: event.target.value }))
                          }
                          className={inputClass}
                        />
                      </label>
                    ))}
                    <label className="grid gap-1">
                      <span className={labelClass}>Nature</span>
                      <select
                        value={edit.nature}
                        onChange={(event) =>
                          setEdit((current) => ({ ...current, nature: event.target.value }))
                        }
                        className={inputClass}
                      >
                        {NATURES.map((nature) => (
                          <option key={nature} value={nature}>
                            {nature}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-6">
                    {IV_KEYS.map((key) => (
                      <label key={key} className="grid gap-1">
                        <span className={labelClass}>IV {key}</span>
                        <input
                          value={editIvs[key]}
                          onChange={(event) =>
                            setEditIvs((current) => ({ ...current, [key]: event.target.value }))
                          }
                          className={inputClass}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {OVERRIDE_FIELDS.map(([key, label]) => (
                      <label key={key} className="grid gap-1">
                        <span className={labelClass}>override {label}</span>
                        <input
                          value={editOverrides[key] ?? ""}
                          placeholder="auto"
                          onChange={(event) =>
                            setEditOverrides((current) => ({
                              ...current,
                              [key]: event.target.value,
                            }))
                          }
                          className={inputClass}
                        />
                      </label>
                    ))}
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <Button size="sm" onClick={() => void savePet()} disabled={busy}>
                      <Pencil className="h-3.5 w-3.5" /> Save pet
                    </Button>
                    <span className="text-[10px] text-muted">
                      power {editPet.power} · hp {editPet.stats.hpMax} · atk {editPet.stats.atk}
                    </span>
                  </div>
                </>
              ) : null}
            </Panel>
          </>
        ) : null}

        <Panel>
          <SectionTitle hint="pet id + destination ranch">Gift pet</SectionTitle>
          <div className="mt-2 grid gap-2 sm:grid-cols-2">
            <label className="grid gap-1">
              <span className={labelClass}>Pet id</span>
              <input
                value={giftPetId}
                onChange={(event) => setGiftPetId(event.target.value)}
                placeholder="uuid"
                className={inputClass}
              />
            </label>
            <label className="grid gap-1">
              <span className={labelClass}>Target player</span>
              <div className="flex gap-1">
                <input
                  value={giftQuery}
                  onChange={(event) => setGiftQuery(event.target.value)}
                  placeholder="name, slug or uuid"
                  className={`${inputClass} flex-1`}
                />
                <Button size="sm" variant="ghost" onClick={() => void searchGiftTargets()} disabled={busy}>
                  <Search className="h-3.5 w-3.5" />
                </Button>
              </div>
            </label>
          </div>
          {giftPlayers.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1">
              {giftPlayers.map((player) => (
                <button
                  key={player.id}
                  onClick={() => setGiftTarget(player)}
                  className={`rounded-full border px-2 py-1 text-[10px] ${
                    giftTarget?.id === player.id
                      ? "border-gold/60 text-gold"
                      : "border-line hover:border-gold/50"
                  }`}
                >
                  {player.displayName} · {player.petCount}/30
                </button>
              ))}
            </div>
          ) : null}
          <div className="mt-3 flex items-center gap-3">
            <Button size="sm" onClick={() => void giftPet()} disabled={busy || !giftTarget}>
              <Gift className="h-3.5 w-3.5" /> Gift
            </Button>
            <span className="text-[10px] text-muted">
              {giftTarget ? `to ${giftTarget.displayName}` : "pick a target"}
            </span>
          </div>
        </Panel>

        <Panel>
          <SectionTitle hint="last 50">Audit log</SectionTitle>
          <div className="mt-2 overflow-x-auto">
            <table className="w-full text-left text-[11px]">
              <thead className="text-muted">
                <tr>
                  <th className="py-1">When</th>
                  <th className="py-1">Actor</th>
                  <th className="py-1">Action</th>
                  <th className="py-1">Target</th>
                </tr>
              </thead>
              <tbody>
                {audit.map((entry) => (
                  <tr key={entry.id} className="border-t border-line/40">
                    <td className="py-1 tabular-nums text-muted">
                      {new Date(entry.createdAt).toLocaleString()}
                    </td>
                    <td className="py-1">{entry.actorLabel}</td>
                    <td className="py-1">{entry.action}</td>
                    <td className="py-1 text-muted">
                      {(entry.targetPetId ?? entry.targetProfileId ?? "—").slice(0, 8)}
                    </td>
                  </tr>
                ))}
                {audit.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-3 text-muted">
                      <ScrollText className="mr-1 inline h-3 w-3" /> No admin actions yet.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </main>
  );
}
