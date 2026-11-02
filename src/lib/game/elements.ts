import type { ElementId } from "./types";

export const ELEMENT_NAMES = [
  "Neutral",
  "Water",
  "Earth",
  "Fire",
  "Wind",
  "Poison",
  "Holy",
  "Dark",
  "Ghost",
  "Undead",
] as const;

export const ELEMENT_COLORS = [
  "#c8c8b8",
  "#4aa3ff",
  "#b07a3a",
  "#ff6b3d",
  "#8fe36b",
  "#a45bd0",
  "#ffd75e",
  "#8b5cf6",
  "#7de3e0",
  "#9a8a7a",
] as const;

export const SIZE_NAMES = ["Small", "Medium", "Large"] as const;

export const RACE_NAMES = [
  "Formless",
  "Undead",
  "Brute",
  "Plant",
  "Insect",
  "Fish",
  "Demon",
  "Demihuman",
  "Angel",
  "Dragon",
  "Boss",
] as const;

export function elementName(id: ElementId): string {
  return ELEMENT_NAMES[id] ?? "Neutral";
}

export function elementColor(id: ElementId): string {
  return ELEMENT_COLORS[id] ?? ELEMENT_COLORS[0];
}

export function elementIndex(name: string): ElementId {
  const idx = ELEMENT_NAMES.indexOf(name as (typeof ELEMENT_NAMES)[number]);
  return (idx >= 0 ? idx : 0) as ElementId;
}
