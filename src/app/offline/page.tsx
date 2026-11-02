import type { Metadata } from "next";
import Link from "next/link";
import { WifiOff } from "lucide-react";

export const metadata: Metadata = {
  title: "Offline",
  robots: { index: false, follow: false },
};

export default function OfflinePage() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-line/60 bg-panel/60 text-muted">
        <WifiOff className="h-7 w-7" />
      </div>
      <h1 className="font-display text-2xl">You&apos;re offline</h1>
      <p className="text-sm text-muted">
        TamaRagna needs a connection for the ranch, battles and care actions. Your pets keep
        their timers while you wait, so nothing is lost.
      </p>
      <Link
        href="/ranch"
        className="rounded-xl bg-teal px-4 py-2 text-sm font-medium text-[#04211d]"
      >
        Try the ranch again
      </Link>
    </main>
  );
}
