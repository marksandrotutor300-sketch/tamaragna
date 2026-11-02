import Link from "next/link";
import {
  ArrowRight,
  Compass,
  Dna,
  Hammer,
  Shield,
  ShoppingBag,
  Sparkles,
  Swords,
  Trophy,
} from "lucide-react";

const LINKS = [
  {
    href: "/guild",
    title: "Guild hall",
    body: "Form a guild and take down a shared weekly raid boss.",
    icon: Shield,
    color: "text-teal",
  },
  {
    href: "/market",
    title: "Auction house",
    body: "Buy and sell storage pets with a 5% sale fee.",
    icon: ShoppingBag,
    color: "text-gold",
  },
  {
    href: "/expeditions",
    title: "Expeditions",
    body: "Send storage pets on timed routes for coins, materials and eggs.",
    icon: Compass,
    color: "text-violet",
  },
  {
    href: "/ranked",
    title: "Ranked circuit",
    body: "Leaderboard, scheduled cups and spectator points.",
    icon: Trophy,
    color: "text-gold",
  },
  {
    href: "/legacy",
    title: "Legacy",
    body: "Retire level-50 pets for marks and stronger future offspring.",
    icon: Dna,
    color: "text-rose",
  },
  {
    href: "/dojo",
    title: "Ghost dojo",
    body: "Train ghosts from your team or last opponent, then spar.",
    icon: Swords,
    color: "text-teal",
  },
  {
    href: "/ranch",
    title: "Ranch habitats",
    body: "Spend expedition materials on a new ranch backdrop.",
    icon: Hammer,
    color: "text-violet",
  },
];

export default function MorePage() {
  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div>
        <div className="text-[10px] uppercase tracking-[0.2em] text-muted">more</div>
        <h1 className="flex items-center gap-2 font-display text-2xl">
          <Sparkles className="h-5 w-5 text-gold" /> The wider ranch
        </h1>
        <p className="mt-1 text-xs text-muted">
          Social, economy, expeditions and long-term progression.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {LINKS.map((link) => {
          const Icon = link.icon;
          return (
            <Link key={link.href} href={link.href}>
              <div className="group flex h-full items-start gap-3 rounded-2xl border border-line/60 bg-panel/40 p-4 transition hover:border-teal/40">
                <Icon className={`mt-0.5 h-5 w-5 ${link.color}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2 text-sm">
                    {link.title}
                    <ArrowRight className="h-3.5 w-3.5 text-muted transition group-hover:translate-x-0.5 group-hover:text-teal" />
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed text-muted">{link.body}</p>
                </div>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
