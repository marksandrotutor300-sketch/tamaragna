import evolutionJson from "@data/generated/evolution.json";

export type EvolutionEdge = {
  from: number;
  to: number;
  stage: number;
  level: number;
  star: number;
  coins: number;
  branch: string;
  family: string;
};

export type EvolutionFamily = {
  id: string;
  name: string;
  species: Array<{
    id: number;
    name: string;
    tier: number;
    stage: number;
  }>;
};

type EvolutionGraph = {
  version: number;
  generatedAt: string;
  families: EvolutionFamily[];
  edges: EvolutionEdge[];
};

const graph = evolutionJson as unknown as EvolutionGraph;
const byFrom = new Map<number, EvolutionEdge[]>();

for (const edge of graph.edges) {
  const list = byFrom.get(edge.from) ?? [];
  list.push(edge);
  byFrom.set(edge.from, list);
}

export const EVOLUTION_EDGES = graph.edges;
export const EVOLUTION_FAMILIES = graph.families;

export function evolutionOptions(speciesId: number): EvolutionEdge[] {
  return byFrom.get(speciesId) ?? [];
}

export function evolutionFamily(speciesId: number): EvolutionFamily | undefined {
  return graph.families.find((family) =>
    family.species.some((entry) => entry.id === speciesId),
  );
}
