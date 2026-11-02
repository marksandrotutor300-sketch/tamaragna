import { notFound } from "next/navigation";
import { getAdminRoleForUser } from "@/lib/admin";
import type { AdminRole } from "@/lib/db/schema";
import { readSession } from "@/lib/db/session";
import { AdminConsole } from "./AdminConsole";

export const dynamic = "force-dynamic";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  const envToken = process.env.ADMIN_TOKEN;
  const viaToken = Boolean(token && envToken && token === envToken);

  let identity: {
    label: string;
    via: "token" | "session";
    role: AdminRole;
  } | null = null;
  if (viaToken) {
    identity = { label: "ADMIN_TOKEN", via: "token", role: "owner" };
  } else {
    const session = await readSession();
    const role = session
      ? await getAdminRoleForUser(session.userId, session.email)
      : null;
    if (session && role) {
      identity = { label: session.email, via: "session", role };
    }
  }

  if (!identity) notFound();

  return (
    <AdminConsole
      initialToken={viaToken ? (token ?? "") : ""}
      actor={identity.label}
      via={identity.via}
      role={identity.role}
    />
  );
}

export const metadata = {
  title: "Super admin | TamaRagna",
  robots: { index: false, follow: false },
};
