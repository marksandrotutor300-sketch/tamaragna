"use client";

import { useState } from "react";
import Link from "next/link";
import { Check, Link2 } from "lucide-react";
import { Button } from "@/components/ui/primitives";
import { api } from "@/lib/client/api";

export function ShareReplayButton({ battleId }: { battleId: string }) {
  const [state, setState] = useState<{
    path?: string;
    error?: string;
    pending?: boolean;
  }>({});
  const [copied, setCopied] = useState(false);

  const share = async () => {
    setState({ pending: true });
    setCopied(false);
    try {
      const result = await api.post<{ path: string; url: string }>(
        `/api/battles/${battleId}/share`,
      );
      setState({ path: result.path });
      try {
        await navigator.clipboard.writeText(result.url);
        setCopied(true);
      } catch {
        // Clipboard permissions vary; the open-replay link is the fallback.
      }
    } catch (error) {
      setState({
        error: error instanceof Error ? error.message : "Could not create a replay link",
      });
    }
  };

  return (
    <div className="space-y-1">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          onClick={share}
          disabled={state.pending}
        >
          {copied ? <Check className="h-3.5 w-3.5" /> : <Link2 className="h-3.5 w-3.5" />}
          {state.pending ? "Creating link..." : copied ? "Link copied" : "Share replay"}
        </Button>
        {state.path ? (
          <Link href={state.path}>
            <Button size="sm" variant="ghost">
              Open replay
            </Button>
          </Link>
        ) : null}
      </div>
      {state.error ? (
        <p className="text-[10px] text-rose">{state.error}</p>
      ) : null}
    </div>
  );
}
