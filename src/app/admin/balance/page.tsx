import { desc } from "drizzle-orm";
import { notFound } from "next/navigation";
import { getAdminRoleForUser } from "@/lib/admin";
import { getDb } from "@/lib/db/client";
import { balanceDaily } from "@/lib/db/schema";
import { readSession } from "@/lib/db/session";

export const dynamic = "force-dynamic";

const DIMENSIONS = ["species", "rarity", "nature", "star", "stage", "skill"] as const;

export default async function BalancePage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const envToken = process.env.ADMIN_TOKEN;
  const { token: provided } = await searchParams;
  let allowed = Boolean(envToken && provided === envToken);
  if (!allowed) {
    const session = await readSession();
    allowed = Boolean(
      session && (await getAdminRoleForUser(session.userId, session.email)),
    );
  }
  if (!allowed) notFound();

  const db = await getDb();
  const rows = await db
    .select()
    .from(balanceDaily)
    .orderBy(desc(balanceDaily.battles))
    .limit(400);

  const outliers = rows.filter(
    (row) =>
      row.dimension === "species" &&
      row.battles >= 10 &&
      (row.wins / row.battles > 0.65 || row.wins / row.battles < 0.35),
  );

  return (
    <main className="mx-auto max-w-5xl px-6 py-10">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted">admin</div>
      <h1 className="font-display text-3xl">Balance telemetry</h1>
      <p className="mt-1 text-xs text-muted">
        Aggregated battle outcomes. Run `npm run balance:aggregate` or
        `POST /api/admin/balance/aggregate` after new battles.
      </p>

      {outliers.length > 0 ? (
        <section className="mt-6 rounded-2xl border border-gold/30 bg-gold/5 p-4">
          <h2 className="font-display text-sm text-gold">Outliers (n ≥ 10)</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-[11px]">
            {outliers.slice(0, 12).map((row) => (
              <span
                key={`${row.day}-${row.mode}-${row.key}`}
                className="rounded-full border border-gold/30 px-2 py-0.5"
              >
                species {row.key} · {row.battles} battles ·{" "}
                {((row.wins / row.battles) * 100).toFixed(0)}%
              </span>
            ))}
          </div>
        </section>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {DIMENSIONS.map((dimension) => {
          const subset = rows.filter((row) => row.dimension === dimension).slice(0, 12);
          return (
            <section
              key={dimension}
              className="rounded-2xl border border-line/60 bg-panel/40 p-4"
            >
              <h2 className="font-display text-sm capitalize">{dimension}</h2>
              {subset.length === 0 ? (
                <p className="mt-2 text-[11px] text-muted">No samples yet.</p>
              ) : (
                <table className="mt-2 w-full text-left text-[11px]">
                  <thead className="text-muted">
                    <tr>
                      <th className="py-1">key</th>
                      <th className="py-1 text-right">n</th>
                      <th className="py-1 text-right">win</th>
                    </tr>
                  </thead>
                  <tbody>
                    {subset.map((row) => (
                      <tr key={`${row.day}-${row.mode}-${row.key}`} className="border-t border-line/40">
                        <td className="py-1">{row.key}</td>
                        <td className="py-1 text-right tabular-nums">{row.battles}</td>
                        <td className="py-1 text-right tabular-nums text-teal">
                          {((row.wins / Math.max(1, row.battles)) * 100).toFixed(0)}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
