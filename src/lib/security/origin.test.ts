import { describe, expect, it } from "vitest";
import { isAllowedOrigin, trustedOrigins } from "./origin";

describe("CSRF origin check", () => {
  it("accepts Render's forwarded public host when Next sees an internal host", () => {
    const headers = new Headers({
      host: "localhost:10000",
      "x-forwarded-host": "tamaragna-ivzp.onrender.com",
    });
    expect(
      isAllowedOrigin(
        "https://tamaragna-ivzp.onrender.com",
        headers,
        "localhost:10000",
        undefined,
      ),
    ).toBe(true);
  });

  it("accepts the configured public URL", () => {
    const headers = new Headers({ host: "internal:10000" });
    expect(
      isAllowedOrigin(
        "https://tamaragna.example.com",
        headers,
        "internal:10000",
        "https://tamaragna.example.com",
      ),
    ).toBe(true);
  });

  it("rejects a different origin", () => {
    const headers = new Headers({ "x-forwarded-host": "tamaragna-ivzp.onrender.com" });
    expect(
      isAllowedOrigin(
        "https://evil.example.com",
        headers,
        "localhost:10000",
        undefined,
      ),
    ).toBe(false);
  });

  it("passes clients without an Origin header and rejects malformed origins", () => {
    const headers = new Headers({ host: "localhost:3000" });
    expect(isAllowedOrigin(null, headers, "localhost:3000")).toBe(true);
    expect(isAllowedOrigin("not a url", headers, "localhost:3000")).toBe(false);
  });

  it("collects forwarded hosts and ignores malformed values", () => {
    const hosts = trustedOrigins(
      new Headers({
        "x-forwarded-host": "a.example.com, proxy.internal",
        host: "internal:10000",
      }),
      "internal:10000",
      "https://b.example.com",
    );
    expect(hosts.has("a.example.com")).toBe(true);
    expect(hosts.has("internal:10000")).toBe(true);
    expect(hosts.has("b.example.com")).toBe(true);
  });
});
