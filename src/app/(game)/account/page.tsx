"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  ClipboardCopy,
  Download,
  ExternalLink,
  KeyRound,
  LogIn,
  LogOut,
  Mail,
  ShieldCheck,
  Upload,
  UserRound,
} from "lucide-react";
import { Button, Panel, SectionTitle, Spinner } from "@/components/ui/primitives";
import {
  useAuthSession,
  useCreateTransferCode,
  useMe,
} from "@/hooks/useGame";
import { api } from "@/lib/client/api";

export default function AccountPage() {
  const { data, isLoading } = useMe();
  const auth = useAuthSession();
  const transfer = useCreateTransferCode();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [card, setCard] = useState<{ slug: string; enabled: boolean } | null>(null);
  const [cardBusy, setCardBusy] = useState(false);
  const [authBusy, setAuthBusy] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMessage, setPushMessage] = useState<string | null>(null);

  if (isLoading || !data) {
    return (
      <div className="flex h-64 items-center justify-center text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  const profile = data.profile;
  const signedIn = Boolean(auth.data?.authenticated);
  const cardEnabled = card?.enabled ?? profile.publicCard;
  const cardSlug = card?.slug ?? profile.publicSlug ?? "";
  const publishedSlug = card?.slug ?? profile.publicSlug ?? "";

  const signOut = async () => {
    setAuthBusy(true);
    try {
      await api.post("/api/auth/logout");
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setMessage("Signed out. This device keeps its ranch.");
    } catch (signOutError) {
      setError(signOutError instanceof Error ? signOutError.message : "Could not sign out");
    } finally {
      setAuthBusy(false);
    }
  };

  const revokeOthers = async () => {
    setAuthBusy(true);
    try {
      await api.post("/api/auth/revoke-others");
      setMessage("Other sessions revoked.");
    } catch (revokeError) {
      setError(
        revokeError instanceof Error ? revokeError.message : "Could not revoke sessions",
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const deleteAccount = async () => {
    if (
      !window.confirm(
        "Delete the account and sign out? Your ranch stays on this device and can be exported first.",
      )
    ) {
      return;
    }
    setAuthBusy(true);
    try {
      await api.del("/api/auth/account");
      await queryClient.invalidateQueries({ queryKey: ["auth"] });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setMessage("Account deleted. The ranch remains anonymous.");
    } catch (deleteError) {
      setError(
        deleteError instanceof Error ? deleteError.message : "Could not delete the account",
      );
    } finally {
      setAuthBusy(false);
    }
  };

  const enablePush = async () => {
    setPushBusy(true);
    setPushMessage(null);
    try {
      if (!("Notification" in window) || !("serviceWorker" in navigator)) {
        throw new Error("This browser does not support push notifications");
      }
      const config = (await fetch("/api/push/public-key").then((response) =>
        response.json(),
      )) as { configured?: boolean; publicKey?: string | null };
      if (!config.configured || !config.publicKey) {
        throw new Error("Push is not configured on this server");
      }

      const permission = await Notification.requestPermission();
      if (permission !== "granted") throw new Error("Notification permission was not granted");

      const registration = await navigator.serviceWorker.ready;
      const existing = await registration.pushManager.getSubscription();
      const subscription =
        existing ??
        (await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(config.publicKey),
        }));

      const json = subscription.toJSON();
      if (!json.keys?.p256dh || !json.keys.auth) {
        throw new Error("Push subscription is missing keys");
      }

      await api.post("/api/push/subscribe", {
        endpoint: subscription.endpoint,
        keys: { p256dh: json.keys.p256dh, auth: json.keys.auth },
      });
      setPushMessage("Care reminders enabled.");
    } catch (pushError) {
      setPushMessage(
        pushError instanceof Error ? pushError.message : "Could not enable push",
      );
    } finally {
      setPushBusy(false);
    }
  };

  const saveCard = async () => {
    setCardBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await api.patch<{
        publicCard: boolean;
        slug: string | null;
      }>("/api/account/public-card", {
        publicCard: cardEnabled,
        slug: cardSlug.trim() || undefined,
      });
      setCard({ slug: result.slug ?? "", enabled: result.publicCard });
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setMessage(
        result.publicCard ? "Trainer card published." : "Trainer card hidden.",
      );
    } catch (cardError) {
      setError(
        cardError instanceof Error ? cardError.message : "Could not save the trainer card",
      );
    } finally {
      setCardBusy(false);
    }
  };

  const downloadSave = async () => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch("/api/account/export");
      if (!response.ok) {
        const body = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error ?? "Could not export the save");
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = url;
      anchor.download = `tamaragna-save-${new Date().toISOString().slice(0, 10)}.json`;
      anchor.click();
      URL.revokeObjectURL(url);
      setMessage("Save downloaded.");
    } catch (downloadError) {
      setError(
        downloadError instanceof Error ? downloadError.message : "Could not export the save",
      );
    } finally {
      setBusy(false);
    }
  };

  const importSave = async (file: File) => {
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const text = await file.text();
      const snapshot = JSON.parse(text);
      const result = await api.post<{ imported: number }>("/api/account/import", snapshot);
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      setMessage(`Imported ${result.imported} pets.`);
    } catch (importError) {
      setError(
        importError instanceof Error ? importError.message : "Could not import the save",
      );
    } finally {
      setBusy(false);
    }
  };

  const copyCode = async () => {
    if (!transfer.data) return;
    await navigator.clipboard.writeText(transfer.data.code);
    setMessage("Transfer code copied.");
  };

  return (
    <div className="space-y-5">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted">account</div>
        <h1 className="flex items-center gap-2 font-display text-2xl">
          <UserRound className="h-5 w-5 text-teal" /> Account &amp; saves
        </h1>
        <p className="mt-1 text-xs text-muted">
          Your ranch lives in this browser&apos;s cookie. A transfer code moves it to a new
          device; an export is a manual backup.
        </p>
      </div>

      <Panel>
        <SectionTitle hint={profile.displayName}>{profile.displayName}</SectionTitle>
        <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <Info label="Coins" value={profile.coins.toLocaleString()} />
          <Info label="Eggs" value={profile.eggs} />
          <Info label="Rating" value={profile.rating} />
          <Info label="Pets" value={data.pets.length} />
        </div>
      </Panel>

      <Panel>
        <SectionTitle hint="opt-in">Public trainer card</SectionTitle>
        <p className="text-[11px] leading-relaxed text-muted">
          Publish a small card with your trainer name, rating and top three pets. It never
          includes your email, device or full roster. Shared replays are separate and use
          an unlisted link.
        </p>
        <label className="mt-3 flex items-center gap-2 text-xs">
          <input
            type="checkbox"
            checked={cardEnabled}
            onChange={(event) =>
              setCard({ enabled: event.target.checked, slug: cardSlug })
            }
            className="h-4 w-4 accent-teal"
          />
          Publish my trainer card
        </label>
        <div className="mt-3 flex flex-wrap items-end gap-2">
          <label className="min-w-0 flex-1 text-[10px] uppercase tracking-[0.14em] text-muted">
            trainer slug
            <input
              value={cardSlug}
              onChange={(event) =>
                setCard({ enabled: cardEnabled, slug: event.target.value })
              }
              placeholder="your-name"
              maxLength={24}
              className="mt-1 w-full rounded-lg border border-line/70 bg-black/30 px-2 py-2 text-xs normal-case tracking-normal text-ink outline-none focus:border-teal/50"
            />
          </label>
          <Button size="sm" variant="ghost" onClick={saveCard} disabled={cardBusy}>
            {cardBusy ? "Saving..." : "Save card"}
          </Button>
          {cardEnabled && publishedSlug ? (
            <Link href={`/trainer/${publishedSlug}`}>
              <Button size="sm" variant="ghost">
                Open card <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </Link>
          ) : null}
        </div>
      </Panel>

      <Panel>
        <SectionTitle hint={signedIn ? "synced" : "anonymous"}>Account sync</SectionTitle>
        {auth.isLoading ? (
          <div className="flex h-16 items-center justify-center text-muted">
            <Spinner className="h-5 w-5" />
          </div>
        ) : signedIn ? (
          <>
            <p className="flex items-center gap-2 text-xs text-muted">
              <Mail className="h-3.5 w-3.5 text-teal" />
              Signed in as <span className="text-ink">{auth.data?.email}</span>
            </p>
            <p className="mt-1 text-[10px] text-muted">
              Signing in uses a magic link. Sessions are revocable; your ranch stays linked
              to this account.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button size="sm" variant="ghost" onClick={signOut} disabled={authBusy}>
                <LogOut className="h-3.5 w-3.5" /> Sign out
              </Button>
              <Button size="sm" variant="ghost" onClick={revokeOthers} disabled={authBusy}>
                <ShieldCheck className="h-3.5 w-3.5" /> Revoke other sessions
              </Button>
              <Button size="sm" variant="ghost" onClick={deleteAccount} disabled={authBusy}>
                Delete account
              </Button>
            </div>
            <div className="mt-4 border-t border-line/50 pt-3">
              <div className="flex items-center gap-2 text-xs">
                <Bell className="h-3.5 w-3.5 text-gold" /> Care reminders
              </div>
              <p className="mt-1 text-[10px] text-muted">
                Web Push works after installing the PWA. It never sends your email.
              </p>
              <Button
                className="mt-2"
                size="sm"
                variant="ghost"
                onClick={enablePush}
                disabled={pushBusy}
              >
                <Bell className="h-3.5 w-3.5" />
                {pushBusy ? "Enabling..." : "Enable care reminders"}
              </Button>
              {pushMessage ? (
                <p className="mt-1 text-[10px] text-muted">{pushMessage}</p>
              ) : null}
            </div>
          </>
        ) : (
          <>
            <p className="text-xs leading-relaxed text-muted">
              Sign in with a magic link to recover this ranch on another device and enable
              care reminders. No password and no automatic ranch merge.
            </p>
            <Link href="/signin" className="mt-3 inline-block">
              <Button size="sm">
                <LogIn className="h-4 w-4" /> Sign in with email
              </Button>
            </Link>
          </>
        )}
      </Panel>

      <Panel>
        <SectionTitle hint="single use">Move to another device</SectionTitle>
        <p className="text-[11px] leading-relaxed text-muted">
          Open <span className="text-ink">/transfer</span> on the new device and enter the
          code. It expires in 15 minutes and can only be used once. The old device loses
          access to this ranch.
        </p>

        {transfer.data ? (
          <div className="mt-3 rounded-xl border border-teal/30 bg-teal/5 p-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <code className="font-mono text-lg tracking-[0.18em] text-teal">
                {transfer.data.code}
              </code>
              <Button size="sm" variant="ghost" onClick={copyCode}>
                <ClipboardCopy className="h-3.5 w-3.5" /> Copy
              </Button>
            </div>
            <div className="mt-1 text-[10px] text-muted">
              Expires {new Date(transfer.data.expiresAt).toLocaleTimeString()}. Creating a
              new code invalidates this one.
            </div>
          </div>
        ) : (
          <div className="mt-3 flex flex-wrap gap-2">
            <Button
              size="sm"
              onClick={() => transfer.mutate()}
              disabled={transfer.isPending}
            >
              <KeyRound className="h-4 w-4" />
              {transfer.isPending ? "Creating..." : "Create transfer code"}
            </Button>
            <Link href="/transfer">
              <Button size="sm" variant="ghost">
                Open transfer page <ArrowRight className="h-3.5 w-3.5" />
              </Button>
            </Link>
          </div>
        )}

        {transfer.error ? (
          <p className="mt-2 text-[10px] text-rose">{transfer.error.message}</p>
        ) : null}
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <Panel>
          <SectionTitle hint="JSON">Export save</SectionTitle>
          <p className="text-[11px] leading-relaxed text-muted">
            Downloads trainer name, coins, eggs and every pet. Battles, quests and season
            rewards are not included.
          </p>
          <Button
            className="mt-3"
            size="sm"
            variant="ghost"
            onClick={downloadSave}
            disabled={busy}
          >
            <Download className="h-4 w-4" /> Download save
          </Button>
        </Panel>

        <Panel>
          <SectionTitle hint="fresh ranch only">Import save</SectionTitle>
          <p className="text-[11px] leading-relaxed text-muted">
            Only works when this ranch has no pets. Use a transfer code to move a full
            profile. Importing resets rating and placements to their starting values.
          </p>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = "";
              if (file) void importSave(file);
            }}
          />
          <Button
            className="mt-3"
            size="sm"
            variant="ghost"
            onClick={() => fileRef.current?.click()}
            disabled={busy}
          >
            <Upload className="h-4 w-4" /> Choose save file
          </Button>
        </Panel>
      </div>

      {message ? (
        <div className="rounded-xl border border-teal/30 bg-teal/5 px-3 py-2 text-xs text-teal">
          {message}
        </div>
      ) : null}
      {error ? (
        <div className="rounded-xl border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">
          {error}
        </div>
      ) : null}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border border-line/60 bg-black/20 px-3 py-2">
      <div className="text-[9px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="font-display text-sm">{value}</div>
    </div>
  );
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const normalized = (base64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(normalized);
  const bytes = new Uint8Array(raw.length);
  for (let index = 0; index < raw.length; index += 1) {
    bytes[index] = raw.charCodeAt(index);
  }
  return bytes;
}
