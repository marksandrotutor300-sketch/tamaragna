export type Habitat = {
  id: string;
  name: string;
  description: string;
  cost: number;
  accent: string;
};

export const HABITATS: Habitat[] = [
  {
    id: "verdant",
    name: "Verdant Grove",
    description: "Soft moss, fireflies and a quiet stream.",
    cost: 0,
    accent: "#3ad7c0",
  },
  {
    id: "ember",
    name: "Ember Hollow",
    description: "Warm stone terraces above a slow lava flow.",
    cost: 120,
    accent: "#ff7a5c",
  },
  {
    id: "tide",
    name: "Tide Terrace",
    description: "Salt air, shell paths and a shallow lagoon.",
    cost: 120,
    accent: "#5cbcff",
  },
  {
    id: "astral",
    name: "Astral Conservatory",
    description: "A floating garden under a violet sky.",
    cost: 250,
    accent: "#b57bff",
  },
];

export function getHabitat(id: string): Habitat {
  return HABITATS.find((habitat) => habitat.id === id) ?? HABITATS[0];
}
