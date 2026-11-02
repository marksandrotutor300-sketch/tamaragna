import { sql } from "drizzle-orm";
import manifest from "@data/generated/manifest.json";
import { getDb } from "@/lib/db/client";
import { getSchemaVersion } from "@/lib/db/migrations";

export const runtime = "nodejs";

export async function GET(): Promise<Response> {
  try {
    const db = await getDb();
    await db.execute(sql`select 1`);
    const schemaVersion = await getSchemaVersion(db);

    return Response.json(
      {
        status: "ok",
        db: "ok",
        data: {
          rathena: manifest.rathena,
          generatedAt: manifest.generatedAt,
          species: manifest.counts.species,
        },
        schemaVersion,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  } catch (error) {
    console.error("[health]", error);
    return Response.json(
      { status: "degraded", db: "error" },
      {
        status: 503,
        headers: { "Cache-Control": "no-store" },
      },
    );
  }
}
