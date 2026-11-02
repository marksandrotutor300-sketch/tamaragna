import { afterEach, describe, expect, it } from "vitest";
import { redirectUrl, siteUrl } from "./site";

const originalPublic = process.env.NEXT_PUBLIC_SITE_URL;
const originalAlias = process.env.SITE_URL;

afterEach(() => {
  if (originalPublic === undefined) delete process.env.NEXT_PUBLIC_SITE_URL;
  else process.env.NEXT_PUBLIC_SITE_URL = originalPublic;
  if (originalAlias === undefined) delete process.env.SITE_URL;
  else process.env.SITE_URL = originalAlias;
});

describe("siteUrl", () => {
  it("prefers the configured public URL and trims the slash", () => {
    delete process.env.SITE_URL;
    process.env.NEXT_PUBLIC_SITE_URL = "https://game.example.com/";
    const request = new Request("http://localhost:10000/api/auth/verify");

    expect(siteUrl(request)).toBe("https://game.example.com");
    expect(redirectUrl(request, "/account?welcome=1").toString()).toBe(
      "https://game.example.com/account?welcome=1",
    );
  });

  it("uses the proxy-forwarded host when nothing is configured", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.SITE_URL;
    const request = new Request("http://localhost:10000/api/auth/google/callback", {
      headers: {
        "x-forwarded-host": "tamaragna-ivzp.onrender.com",
        "x-forwarded-proto": "https",
      },
    });

    expect(siteUrl(request)).toBe("https://tamaragna-ivzp.onrender.com");
    expect(redirectUrl(request, "/signin?error=x").toString()).toBe(
      "https://tamaragna-ivzp.onrender.com/signin?error=x",
    );
  });

  it("falls back to the request origin", () => {
    delete process.env.NEXT_PUBLIC_SITE_URL;
    delete process.env.SITE_URL;
    expect(siteUrl(new Request("http://localhost:3000/x"))).toBe(
      "http://localhost:3000",
    );
    expect(siteUrl()).toBe("http://localhost:3000");
  });
});
