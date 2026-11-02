"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowLeft, Mail } from "lucide-react";
import { Button, Spinner } from "@/components/ui/primitives";
import { useRequestMagicLink } from "@/hooks/useGame";

export default function SignInPage() {
  const request = useRequestMagicLink();
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    setError(null);
    try {
      await request.mutateAsync(email.trim());
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "Could not send the link",
      );
    }
  };

  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col justify-center px-6 py-10">
      <Link
        href="/account"
        className="flex items-center gap-1 text-[10px] uppercase tracking-[0.2em] text-muted transition hover:text-ink"
      >
        <ArrowLeft className="h-3 w-3" /> account
      </Link>

      <div className="mt-6 flex items-center gap-2">
        <Mail className="h-5 w-5 text-teal" />
        <h1 className="font-display text-2xl">Sign in to TamaRagna</h1>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        We send a one-time link. There is no password. Signing in links this ranch to
        your email so you can recover it on a new device.
      </p>

      {request.data ? (
        <div className="mt-6 rounded-2xl border border-teal/30 bg-teal/5 p-4">
          <div className="font-display text-lg text-teal">Check your inbox</div>
          <p className="mt-1 text-xs text-muted">
            The link expires in 15 minutes. You can close this tab after opening it.
          </p>
          {request.data.devLink ? (
            <a
              href={request.data.devLink}
              className="mt-3 inline-block rounded-lg border border-gold/40 bg-gold/10 px-3 py-2 text-xs text-gold"
            >
              Development sign-in link
            </a>
          ) : null}
        </div>
      ) : (
        <div className="mt-6 space-y-3">
          <label className="block text-[10px] uppercase tracking-[0.14em] text-muted">
            Email
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && email.trim()) void submit();
              }}
              placeholder="you@example.com"
              autoComplete="email"
              className="mt-1 w-full rounded-xl border border-line bg-black/40 px-3 py-3 text-sm normal-case tracking-normal outline-none focus:border-teal/60"
            />
          </label>
          <Button
            className="w-full"
            onClick={() => void submit()}
            disabled={request.isPending || !email.trim()}
          >
            {request.isPending ? <Spinner /> : <Mail className="h-4 w-4" />}
            {request.isPending ? "Sending..." : "Email me a sign-in link"}
          </Button>
          {error ? (
            <p className="rounded-lg border border-rose/30 bg-rose/10 px-3 py-2 text-xs text-rose">
              {error}
            </p>
          ) : null}
        </div>
      )}

      <p className="mt-6 text-[10px] leading-relaxed text-muted/70">
        Signing in does not merge two ranches. If your account already has a ranch, that
        ranch is used; the current device ranch stays anonymous. Transfer codes still work.
      </p>
    </main>
  );
}
