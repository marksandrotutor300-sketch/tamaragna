import { z } from "zod";
import {
  AuthRequiredError,
  getActor,
  type Actor,
} from "@/lib/db/actor";
import type { Profile } from "@/lib/db/schema";

export function ok(data: unknown, status = 200): Response {
  return Response.json(data, { status });
}

export function fail(message: string, status = 400): Response {
  return Response.json({ error: message }, { status });
}

export async function parseBody<T>(
  request: Request,
  schema: z.ZodType<T>,
): Promise<{ data: T } | { error: Response }> {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return { error: fail("Invalid JSON body", 400) };
  }

  const parsed = schema.safeParse(json);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    return { error: fail(issue ? `${issue.path.join(".")}: ${issue.message}` : "Invalid request", 422) };
  }

  return { data: parsed.data };
}

export async function withActor(
  handler: (actor: Actor) => Promise<Response>,
): Promise<Response> {
  try {
    const actor = await getActor();
    return await handler(actor);
  } catch (error) {
    if (error instanceof AuthRequiredError) {
      return fail("Sign in required", 401);
    }
    console.error("[api]", error);
    return fail("Something went wrong", 500);
  }
}

export async function withUser(
  handler: (profile: Profile) => Promise<Response>,
): Promise<Response> {
  return withActor(async (actor) => handler(actor.profile));
}

export function clientSeed(): string {
  return crypto.randomUUID();
}
