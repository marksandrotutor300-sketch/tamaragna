export type MobAction = "idle" | "walk" | "attack" | "hurt" | "dead";

export const MOB_ACTIONS: MobAction[] = ["idle", "walk", "attack", "hurt", "dead"];

export function parseMobAction(value: string | null): MobAction {
  return MOB_ACTIONS.includes(value as MobAction) ? (value as MobAction) : "idle";
}

export type SpriteRequest = {
  speciesId: number;
  action: MobAction;
  dir: number;
  frame?: number;
};

export type SpriteProvider = {
  id: string;
  /** true when the provider has real per-action animations */
  supportsActions: boolean;
  url(request: SpriteRequest): string | null;
  /** providers that need a POST (zrenderer) implement this instead of url() */
  fetchImage?(request: SpriteRequest): Promise<Response | null>;
};

const RAGASSETS_ACTION_BASE: Record<MobAction, number> = {
  idle: 0,
  walk: 8,
  attack: 16,
  hurt: 24,
  dead: 32,
};

/**
 * Community renderer that serves animated APNG per monster action.
 * action = type * 8 + direction (0=S ... 7=SE).
 */
export const ragassetsProvider: SpriteProvider = {
  id: "ragassets",
  supportsActions: true,
  url({ speciesId, action, dir, frame }) {
    const base = RAGASSETS_ACTION_BASE[action] + Math.min(7, Math.max(0, dir));
    const params = new URLSearchParams({
      job: String(speciesId),
      action: String(base),
    });
    if (frame !== undefined) params.set("frame", String(frame));
    return `https://assets.latam-tools.com.br/image?${params.toString()}`;
  },
};

/**
 * Static stills only. Used as the fallback when the animated source is down;
 * the client adds CSS motion for non-idle actions.
 */
export const divinePrideProvider: SpriteProvider = {
  id: "divine-pride",
  supportsActions: false,
  url({ speciesId }) {
    return `https://static.divine-pride.net/images/mobs/png/${speciesId}.png`;
  },
};

/**
 * Self-hosted zrenderer. Opt-in via ASSET_PROVIDER=zrenderer so the game can be
 * run without any third-party CDN.
 */
export function zrendererProvider(baseUrl: string, token?: string): SpriteProvider {
  const root = baseUrl.replace(/\/$/, "");
  const actionIndex: Record<MobAction, number> = {
    idle: 0,
    walk: 8,
    attack: 16,
    hurt: 24,
    dead: 32,
  };

  return {
    id: "zrenderer",
    supportsActions: true,
    url() {
      return null;
    },
    async fetchImage({ speciesId, action, dir, frame }) {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["x-accesstoken"] = token;
      const body = {
        job: [String(speciesId)],
        action: actionIndex[action] + Math.min(7, Math.max(0, dir)),
        frame: frame ?? -1,
        outputFormat: 0,
      };
      try {
        return await fetch(`${root}/render?downloadimage=true`, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
        });
      } catch {
        return null;
      }
    },
  };
}
