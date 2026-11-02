import { NextResponse, type NextRequest } from "next/server";
import { ensureOwnerEmail } from "@/lib/admin";
import { resolveProfileForUser, resolveUser } from "@/lib/auth/account";
import { consumeMagicToken } from "@/lib/auth/magic";
import { createSession, hashToken } from "@/lib/db/session";
import { checkRateLimit, clientKey, LIMITS } from "@/lib/rate-limit";
import { redirectUrl } from "@/lib/site";

export const runtime = "nodejs";

export async function GET(request: NextRequest): Promise<Response> {
  const ip = clientKey(request);
  if (!(await checkRateLimit(`${ip}:auth-verify`, LIMITS.authVerify))) {
    return NextResponse.redirect(redirectUrl(request, "/signin?error=rate"));
  }

  const token = request.nextUrl.searchParams.get("token") ?? "";
  const email = token ? await consumeMagicToken(token) : null;
  if (!email) {
    return NextResponse.redirect(redirectUrl(request, "/signin?error=invalid"));
  }

  const user = await resolveUser(email);
  await resolveProfileForUser(user.id);
  await ensureOwnerEmail(user.id, user.email);

  await createSession(user.id, {
    userAgent: request.headers.get("user-agent"),
    ipHash: hashToken(ip),
  });

  return NextResponse.redirect(redirectUrl(request, "/account?welcome=1"));
}
