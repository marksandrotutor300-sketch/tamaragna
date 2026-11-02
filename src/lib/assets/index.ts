import {
  divinePrideProvider,
  ragassetsProvider,
  zrendererProvider,
  type SpriteProvider,
  type SpriteRequest,
} from "./providers";

export * from "./providers";

export function configuredProvider(): SpriteProvider {
  const choice = (process.env.ASSET_PROVIDER ?? "ragassets").toLowerCase();
  if (choice === "divine-pride") return divinePrideProvider;
  if (choice === "zrenderer") {
    const url = process.env.ZRENDERER_URL;
    if (!url) return ragassetsProvider;
    return zrendererProvider(url, process.env.ZRENDERER_TOKEN);
  }
  return ragassetsProvider;
}

export type SpriteResult = {
  body: ArrayBuffer;
  contentType: string;
  provider: string;
};

/** Try the configured provider, then the always-available static fallback. */
export async function fetchSprite(
  request: SpriteRequest,
  options: { staticOnly?: boolean } = {},
): Promise<SpriteResult | null> {
  const providers = options.staticOnly
    ? [divinePrideProvider]
    : [configuredProvider(), divinePrideProvider];
  const seen = new Set<string>();

  for (const provider of providers) {
    if (seen.has(provider.id)) continue;
    seen.add(provider.id);
    const result = await tryProvider(provider, request);
    if (result) return result;
  }

  return null;
}

async function tryProvider(
  provider: SpriteProvider,
  request: SpriteRequest,
): Promise<SpriteResult | null> {
  try {
    const response = provider.fetchImage
      ? await provider.fetchImage(request)
      : await fetch(provider.url(request) ?? "", {
          next: { revalidate: 2_592_000 },
          headers: { "User-Agent": "tamaragna/0.1 (fan project)" },
        });

    if (!response || !response.ok) return null;

    const contentType = response.headers.get("content-type") ?? "image/png";
    if (!contentType.startsWith("image/")) return null;

    const body = await response.arrayBuffer();
    if (body.byteLength === 0) return null;

    return { body, contentType, provider: provider.id };
  } catch {
    return null;
  }
}
