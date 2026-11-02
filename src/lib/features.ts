export type Feature =
  | "share"
  | "telemetry"
  | "accounts"
  | "evolution"
  | "livePvp";

const ENV_KEYS: Record<Feature, string> = {
  share: "FEATURE_SHARE",
  telemetry: "FEATURE_TELEMETRY",
  accounts: "FEATURE_ACCOUNTS",
  evolution: "FEATURE_EVOLUTION",
  livePvp: "FEATURE_LIVE_PVP",
};

// Share and telemetry are the low-risk M1/M2 features and ship enabled.
// Accounts, evolution and live PvP stay dark until their milestones land.
const DEFAULT_ENABLED: Record<Feature, boolean> = {
  share: true,
  telemetry: true,
  accounts: true,
  evolution: true,
  livePvp: true,
};

export function isFeatureEnabled(feature: Feature): boolean {
  const raw = process.env[ENV_KEYS[feature]];
  if (raw === undefined) return DEFAULT_ENABLED[feature];
  return raw === "1" || raw.toLowerCase() === "true";
}

export function featureUnavailable(feature: Feature): Response | null {
  if (isFeatureEnabled(feature)) return null;
  return Response.json({ error: "Not available" }, { status: 404 });
}
