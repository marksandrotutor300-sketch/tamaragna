export type EggKind = "wild" | "focused";

/** Eggs consumed per hatch. Focused eggs let the player pick an element. */
export const EGG_COSTS: Record<EggKind, number> = {
  wild: 1,
  focused: 2,
};
