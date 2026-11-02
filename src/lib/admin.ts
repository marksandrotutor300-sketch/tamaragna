/**
 * Minimal admin gate until accounts land. Set ADMIN_TOKEN and send it as
 * `Authorization: Bearer <token>` or `x-admin-token`. Missing config denies all.
 */
export function isAdminRequest(request: Request): boolean {
  const token = process.env.ADMIN_TOKEN;
  if (!token) return false;
  const authorization = request.headers.get("authorization") ?? "";
  const headerToken = request.headers.get("x-admin-token") ?? "";
  return authorization === `Bearer ${token}` || headerToken === token;
}

export function adminGuard(request: Request): Response | null {
  if (isAdminRequest(request)) return null;
  return Response.json({ error: "Not found" }, { status: 404 });
}
