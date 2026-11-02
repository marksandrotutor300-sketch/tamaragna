import { z } from "zod";
import { fail, ok, parseBody } from "@/lib/api";
import { issueMagicToken } from "@/lib/auth/magic";
import { sendMagicLink } from "@/lib/email";
import { checkRateLimit, clientKey, LIMITS } from "@/lib/rate-limit";
import { siteUrl } from "@/lib/site";

export const runtime = "nodejs";

const schema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
});

export async function POST(request: Request): Promise<Response> {
  const ip = clientKey(request);
  if (!(await checkRateLimit(`${ip}:auth-email`, LIMITS.authEmail))) {
    return fail("Too many sign-in emails - wait a few minutes", 429);
  }

  const parsed = await parseBody(request, schema);
  if ("error" in parsed) return parsed.error;

  const email = parsed.data.email;
  if (!(await checkRateLimit(`${email}:auth-email`, LIMITS.authEmail))) {
    return fail("Too many sign-in emails - wait a few minutes", 429);
  }

  const { token, expiresAt } = await issueMagicToken(email);
  const url = `${siteUrl(request)}/api/auth/verify?token=${encodeURIComponent(token)}`;

  try {
    await sendMagicLink(email, url);
  } catch (error) {
    console.error("[auth] magic link delivery failed", error);
  }

  return ok({
    ok: true,
    expiresAt: expiresAt.toISOString(),
    ...(process.env.AUTH_DEV_MODE === "1" ? { devLink: url } : {}),
  });
}
