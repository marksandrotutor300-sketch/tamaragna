"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BookOpen,
  Castle,
  Coins,
  Egg,
  Home,
  LayoutGrid,
  ListChecks,
  Sparkles,
  Swords,
  UserRound,
  Users,
} from "lucide-react";
import { cn } from "@/lib/client/cn";
import { useMe } from "@/hooks/useGame";
import { Spinner } from "@/components/ui/primitives";

const NAV = [
  { href: "/ranch", label: "Ranch", icon: Home },
  { href: "/team", label: "Team", icon: Users },
  { href: "/hatch", label: "Hatch", icon: Egg },
  { href: "/tower", label: "Tower", icon: Castle },
  { href: "/pvp", label: "Arena", icon: Swords },
  { href: "/bestiary", label: "Bestiary", icon: BookOpen },
  { href: "/quests", label: "Quests", icon: ListChecks },
  { href: "/more", label: "More", icon: LayoutGrid },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { data, isLoading, isError } = useMe();

  if (isLoading) {
    return (
      <div className="flex min-h-dvh items-center justify-center text-muted">
        <Spinner className="h-6 w-6" />
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="mx-auto flex min-h-dvh max-w-md flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="font-display text-xl">Could not reach the ranch</div>
        <p className="text-sm text-muted">
          The server or database is not responding. Refresh to try again.
        </p>
        <button
          className="rounded-xl bg-teal px-4 py-2 text-sm font-medium text-[#04211d]"
          onClick={() => window.location.reload()}
        >
          Retry
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-6xl">
      <aside className="hidden w-52 shrink-0 flex-col border-r border-line/50 px-3 py-5 md:flex">
        <Link href="/ranch" className="mb-6 flex items-center gap-2 px-2">
          <Sparkles className="h-5 w-5 text-gold" />
          <span className="font-display text-lg tracking-tight">TamaRagna</span>
        </Link>

        <nav className="flex flex-col gap-1">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition",
                  active
                    ? "bg-teal/12 text-teal shadow-[inset_0_0_0_1px_rgba(58,215,192,.25)]"
                    : "text-muted hover:bg-white/5 hover:text-ink",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto space-y-2 pt-6">
          <Link
            href="/account"
            className="mb-1 flex items-center gap-2 rounded-xl px-3 py-2 text-xs text-muted transition hover:bg-white/5 hover:text-ink"
          >
            <UserRound className="h-4 w-4" /> Account
          </Link>
          <Currency icon={<Coins className="h-3.5 w-3.5 text-gold" />} value={data.profile.coins} />
          <Currency icon={<Egg className="h-3.5 w-3.5 text-teal" />} value={data.profile.eggs} />
          <Currency
            icon={<Swords className="h-3.5 w-3.5 text-violet" />}
            value={data.profile.rating}
            label="rating"
          />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="sticky top-0 z-20 flex items-center justify-between border-b border-line/40 bg-bg/80 px-4 py-3 backdrop-blur md:hidden">
          <Link href="/ranch" className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-gold" />
            <span className="font-display text-base">TamaRagna</span>
          </Link>
          <div className="flex items-center gap-2">
            <Currency icon={<Coins className="h-3 w-3 text-gold" />} value={data.profile.coins} compact />
            <Currency icon={<Egg className="h-3 w-3 text-teal" />} value={data.profile.eggs} compact />
            <Link
              href="/account"
              aria-label="Account"
              className="rounded-lg border border-line/60 bg-panel/60 p-1.5 text-muted transition hover:text-ink"
            >
              <UserRound className="h-3.5 w-3.5" />
            </Link>
          </div>
        </header>

        <main className="flex-1 px-4 pb-28 pt-4 md:px-7 md:pb-10 md:pt-6">{children}</main>

        <nav className="fixed inset-x-0 bottom-0 z-20 flex justify-around border-t border-line/60 bg-bg/95 px-1 py-1.5 backdrop-blur md:hidden">
          {NAV.map((item) => {
            const active = pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 rounded-lg py-1.5 text-[9px]",
                  active ? "text-teal" : "text-muted",
                )}
              >
                <Icon className="h-4 w-4" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}

function Currency({
  icon,
  value,
  label,
  compact,
}: {
  icon: React.ReactNode;
  value: number;
  label?: string;
  compact?: boolean;
}) {
  return (
    <div
      className={cn(
        "flex items-center gap-2 rounded-lg border border-line/60 bg-panel/60 px-2.5 py-1.5",
        compact && "px-2 py-1",
      )}
    >
      {icon}
      <span className="text-xs font-medium tabular-nums">{value.toLocaleString()}</span>
      {label ? <span className="text-[10px] text-muted">{label}</span> : null}
    </div>
  );
}
