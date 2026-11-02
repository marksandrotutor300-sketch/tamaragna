"use client";

import { Suspense } from "react";
import { useParams, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Button, Spinner } from "@/components/ui/primitives";
import { LiveArena } from "@/components/live/LiveArena";

export default function LiveMatchPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-64 items-center justify-center text-muted">
          <Spinner className="h-6 w-6" />
        </div>
      }
    >
      <Inner />
    </Suspense>
  );
}

function Inner() {
  const params = useParams<{ id: string }>();
  const search = useSearchParams();
  const ticket = search.get("ticket");
  const seat = search.get("seat") === "b" ? "b" : "a";

  if (!ticket) {
    return (
      <div className="mx-auto max-w-md py-16 text-center">
        <p className="text-sm text-muted">Missing match ticket.</p>
        <Link href="/pvp/live" className="mt-4 inline-block">
          <Button variant="ghost">Back to live queue</Button>
        </Link>
      </div>
    );
  }

  return <LiveArena matchId={params.id} ticket={ticket} seat={seat} />;
}
