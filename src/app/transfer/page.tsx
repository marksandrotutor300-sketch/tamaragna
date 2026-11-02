"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowLeft, ArrowRight, KeyRound } from "lucide-react";
import { Button, Spinner } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";

export default function TransferPage() {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [moved, setMoved] = useState<{ displayName: string } | null>(null);

  const submit = async () => {
    setPending(true);
    setError(null);
    try {
      const result = await api.post<{ moved: boolean; displayName: string }>(
        "/api/account/transfer/redeem",
        { code },
      );
      setMoved({ displayName: result.displayName });
    } catch (transferError) {
      setError(
        transferError instanceof Error ? transferError.message : "Could not redeem the code",
      );
    } finally {
      setPending(false);
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <Link
        href="/"
        className="flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-muted transition hover:text-ink"
      >
        <ArrowLeft className="h-3 w-3" /> back
      </Link>

      <div className="mt-6 flex items-center gap-2">
        <KeyRound className="h-5 w-5 text-gold" />
        <h1 className="font-display text-2xl">Move your ranch</h1>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        Enter the transfer code from your old device. This browser must not already have a
        ranch; if it does, use a private window or clear its cookies first.
      </p>

      {moved ? (
        <div className="mt-6 rounded-2xl border border-teal/30 bg-teal/5 p-4">
          <div className="font-display text-lg text-teal">Ranch moved</div>
          <p className="mt-1 text-xs text-muted">
            {moved.displayName}&apos;s ranch is now on this device. The old device no longer
            has access.
          </p>
          <Link href="/ranch" className="mt-4 inline-block">
            <Button>
              Enter the ranch <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <label className="block text-[10px] uppercase tracking-[0.14em] text-muted">
            Transfer code
          </label>
          <input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            onKeyDown={(event) => {
              if (event.key === "Enter" && code.trim().length >= 6 && !pending) {
                void submit();
              }
            }}
            placeholder="ABCDE-FGHIJ"
            maxLength={24}
            autoComplete="off"
            spellCheck={false}
            className="w-full rounded-xl border border-line bg-black/40 px-3 py-3 text-center font-mono text-lg tracking-[0.18em] outline-none focus:border-teal/60"
          />
          <Button
            className="w-full"
            onClick={() => void submit()}
            disabled={pending || code.trim().length < 6}
          >
            {pending ? <Spinner /> : <KeyRound className="h-4 w-4" />}
            {pending ? "Moving..." : "Move ranch here"}
          </Button>
          {error ? (
            <p className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">
              {error}
            </p>
          ) : null}
        </div>
      )}

      <p className="mt-6 text-[10px] leading-relaxed text-muted/70">
        Transfer codes expire after 15 minutes and can only be used once. If you lose the
        code, generate a new one from Account on the old device.
      </p>
    </main>
  );
}
