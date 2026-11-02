import { randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import {
  buildGoogleAuthUrl,
  googleConfigured,
  googleRedirectUri,
  OAUTH_STATE_COOKIE,
  OAUTH_STATE_MAX_AGE,
} from "@/lib/auth/google";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  if (!googleConfigured()) {
    return NextResponse.redirect(new URL("/signin?error=google-unavailable", request.url));
  }

  const state = randomBytes(24).toString("base64url");
  const jar = await cookies();
  jar.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: OAUTH_STATE_MAX_AGE,
  });

  return NextResponse.redirect(
    buildGoogleAuthUrl({
      clientId: process.env.GOOGLE_CLIENT_ID as string,
      redirectUri: googleRedirectUri(siteUrl(request)),
      state,
    }),
  );
}
