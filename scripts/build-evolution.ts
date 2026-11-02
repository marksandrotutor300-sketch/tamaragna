import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { parse as parseYaml } from "yaml";

type SpeciesJson = {
  id: number;
  name: string;
  playable: boolean;
  tier: number;
};

type EvolutionSource = {
  version: number;
  families: Array<{
    id: string;
    name: string;
    species: number[];
  }>;
};

type Edge = {
  from: number;
  to: number;
  stage: number;
  level: number;
  star: number;
  coins: number;
  branch: string;
  family: string;
};

const OUT = path.join(process.cwd(), "data", "generated", "evolution.json");

async function main(): Promise<void> {
  const species = JSON.parse(
    await readFile(path.join(process.cwd(), "data", "generated", "species.json"), "utf8"),
  ) as SpeciesJson[];
  const byId = new Map(species.map((entry) => [entry.id, entry]));
  const source = parseYaml(
    await readFile(path.join(process.cwd(), "data", "evolution.yaml"), "utf8"),
  ) as EvolutionSource;

  if (source.version !== 1) throw new Error("Unsupported evolution schema version");

  const seenFamily = new Set<string>();
  const seenEdge = new Set<string>();
  const edges: Edge[] = [];
  const families = [];

  for (const family of source.families) {
    if (seenFamily.has(family.id)) throw new Error(`Duplicate family ${family.id}`);
    seenFamily.add(family.id);
    if (family.species.length < 2 || family.species.length > 3) {
      throw new Error(`${family.id} must have 2 or 3 stages`);
    }

    for (const id of family.species) {
      const entry = byId.get(id);
      if (!entry) throw new Error(`${family.id}: unknown species ${id}`);
      if (!entry.playable) throw new Error(`${family.id}: species ${id} is not playable`);
    }

    const stages = family.species.map((id, index) => {
      const entry = byId.get(id)!;
      return {
        id,
        name: entry.name,
        tier: entry.tier,
        stage: index + 1,
      };
    });

    for (let index = 1; index < family.species.length; index += 1) {
      const from = family.species[index - 1];
      const to = family.species[index];
      const edgeKey = `${from}->${to}`;
      if (seenEdge.has(edgeKey)) throw new Error(`Duplicate evolution edge ${edgeKey}`);
      seenEdge.add(edgeKey);
      edges.push({
        from,
        to,
        stage: index + 1,
        level: 50,
        star: index + 1,
        coins: index === 1 ? 1000 : 2500,
        branch: family.id,
        family: family.name,
      });
    }

    families.push({
      id: family.id,
      name: family.name,
      species: stages,
    });
  }

  const byFrom = new Map<number, number[]>();
  for (const edge of edges) {
    const list = byFrom.get(edge.from) ?? [];
    list.push(edge.to);
    byFrom.set(edge.from, list);
  }

  const visiting = new Set<number>();
  const visited = new Set<number>();
  const visit = (id: number) => {
    if (visiting.has(id)) throw new Error(`Evolution cycle at species ${id}`);
    if (visited.has(id)) return;
    visiting.add(id);
    for (const next of byFrom.get(id) ?? []) visit(next);
    visiting.delete(id);
    visited.add(id);
  };
  for (const id of byFrom.keys()) visit(id);

  await mkdir(path.dirname(OUT), { recursive: true });
  await writeFile(
    OUT,
    `${JSON.stringify(
      {
        version: 1,
        generatedAt: new Date().toISOString(),
        families,
        edges,
      },
      null,
      2,
    )}\n`,
  );

  console.log(
    `Evolution graph: ${families.length} families, ${edges.length} edges, ${byFrom.size} source species`,
  );
  process.exit(0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
