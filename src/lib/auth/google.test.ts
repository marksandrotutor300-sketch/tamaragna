import { afterEach, describe, expect, it } from "vitest";
import { buildGoogleAuthUrl, googleConfigured, googleRedirectUri } from "./google";

const ID_KEY = "GOOGLE_CLIENT_ID";
const SECRET_KEY = "GOOGLE_CLIENT_SECRET";
const originalId = process.env[ID_KEY];
const originalSecret = process.env[SECRET_KEY];

afterEach(() => {
  if (originalId === undefined) delete process.env[ID_KEY];
  else process.env[ID_KEY] = originalId;
  if (originalSecret === undefined) delete process.env[SECRET_KEY];
  else process.env[SECRET_KEY] = originalSecret;
});

describe("Google OAuth helpers", () => {
  it("builds the consent URL with the required parameters", () => {
    const url = new URL(
      buildGoogleAuthUrl({
        clientId: "client-123",
        redirectUri: "https://game.example.com/api/auth/google/callback",
        state: "state-xyz",
      }),
    );

    expect(`${url.origin}${url.pathname}`).toBe(
      "https://accounts.google.com/o/oauth2/v2/auth",
    );
    expect(url.searchParams.get("client_id")).toBe("client-123");
    expect(url.searchParams.get("redirect_uri")).toBe(
      "https://game.example.com/api/auth/google/callback",
    );
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toBe("state-xyz");
    expect(url.searchParams.get("prompt")).toBe("select_account");
  });

  it("derives the callback URL and trims a trailing slash", () => {
    expect(googleRedirectUri("https://game.example.com/")).toBe(
      "https://game.example.com/api/auth/google/callback",
    );
    expect(googleRedirectUri("http://localhost:3000")).toBe(
      "http://localhost:3000/api/auth/google/callback",
    );
  });

  it("reports whether the client credentials are configured", () => {
    delete process.env[ID_KEY];
    delete process.env[SECRET_KEY];
    expect(googleConfigured()).toBe(false);

    process.env[ID_KEY] = "id";
    expect(googleConfigured()).toBe(false);

    process.env[SECRET_KEY] = "secret";
    expect(googleConfigured()).toBe(true);
  });
});
