import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { ensureOwnerEmail } from "@/lib/admin";
import { resolveProfileForUser, resolveUser } from "@/lib/auth/account";
import {
  exchangeGoogleCode,
  googleConfigured,
  googleRedirectUri,
  OAUTH_STATE_COOKIE,
} from "@/lib/auth/google";
import { checkRateLimit, clientKey, LIMITS } from "@/lib/rate-limit";
import { createSession, hashToken } from "@/lib/db/session";
import { siteUrl, redirectUrl } from "@/lib/site";

export const runtime = "nodejs";

function back(request: NextRequest, error: string): Response {
  return NextResponse.redirect(redirectUrl(request, `/signin?error=${error}`));
}

export async function GET(request: NextRequest): Promise<Response> {
  const ip = clientKey(request);
  if (!(await checkRateLimit(`${ip}:auth-verify`, LIMITS.authVerify))) {
    return back(request, "rate");
  }
  if (!googleConfigured()) return back(request, "google-unavailable");

  const params = request.nextUrl.searchParams;
  if (params.get("error")) return back(request, "google-denied");

  const jar = await cookies();
  const expected = jar.get(OAUTH_STATE_COOKIE)?.value ?? "";
  jar.delete(OAUTH_STATE_COOKIE);

  const state = params.get("state") ?? "";
  if (!expected || state !== expected) return back(request, "google-state");

  const code = params.get("code") ?? "";
  if (!code) return back(request, "google-code");

  try {
    const identity = await exchangeGoogleCode({
      code,
      redirectUri: googleRedirectUri(siteUrl(request)),
    });
    if (!identity.emailVerified) return back(request, "google-email");

    const user = await resolveUser(identity.email);
    await resolveProfileForUser(user.id);
    await ensureOwnerEmail(user.id, user.email);
    await createSession(user.id, {
      userAgent: request.headers.get("user-agent"),
      ipHash: hashToken(ip),
    });

    return NextResponse.redirect(redirectUrl(request, "/account?welcome=1"));
  } catch (error) {
    console.error("[auth] google sign-in failed", error);
    return back(request, "google-failed");
  }
}
