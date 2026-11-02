"use client";

import { useState } from "react";
import { Heart } from "lucide-react";
import { Button } from "@/components/ui/primitives";

export function VisitRanchButton({ slug }: { slug: string }) {
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const visit = async () => {
    setBusy(true);
    try {
      const response = await fetch(`/api/ranch/${slug}/visit`, { method: "POST" });
      const body = (await response.json()) as { error?: string; coins?: number };
      if (!response.ok) throw new Error(body.error ?? "Could not visit");
      setStatus(`Visited! +5 coins (${body.coins ?? "?"} total)`);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Could not visit");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="text-center">
      <Button size="sm" variant="ghost" onClick={visit} disabled={busy}>
        <Heart className="h-3.5 w-3.5 text-rose" />
        {busy ? "Visiting..." : "Visit ranch"}
      </Button>
      {status ? <p className="mt-2 text-[10px] text-muted">{status}</p> : null}
    </div>
  );
}
