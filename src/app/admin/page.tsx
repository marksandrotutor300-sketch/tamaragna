import { notFound } from "next/navigation";
import { isSuperAdminUser } from "@/lib/admin";
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

  let identity: { label: string; via: "token" | "session" } | null = null;
  if (viaToken) {
    identity = { label: "ADMIN_TOKEN", via: "token" };
  } else {
    const session = await readSession();
    if (session && (await isSuperAdminUser(session.userId))) {
      identity = { label: session.email, via: "session" };
    }
  }

  if (!identity) notFound();

  return (
    <AdminConsole
      initialToken={viaToken ? (token ?? "") : ""}
      actor={identity.label}
      via={identity.via}
    />
  );
}

export const metadata = {
  title: "Super admin | TamaRagna",
  robots: { index: false, follow: false },
};
