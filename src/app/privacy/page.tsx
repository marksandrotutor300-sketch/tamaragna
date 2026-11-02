import Link from "next/link";

export const metadata = {
  title: "Privacy | TamaRagna",
  description: "What TamaRagna stores, why, and how to remove it.",
};

const SECTIONS = [
  {
    title: "What is stored",
    body:
      "A random device id in a cookie identifies an anonymous ranch, so pets, coins and progress load on that browser. Sign-in adds an email address and a session token. Pet and battle records are linked to the ranch, not to the email.",
  },
  {
    title: "Sign-in providers",
    body:
      "Signing in with Google shares your Google account email with this site; it is stored only to identify your account. Magic-link sign-in stores the email you submit and a hashed, single-use login token that expires after 15 minutes.",
  },
  {
    title: "Cookies",
    body:
      "Two httpOnly cookies are used: tr_device for the anonymous ranch and tr_session for a signed-in account. A short-lived tr_oauth_state cookie protects Google sign-in. There are no advertising or third-party tracking cookies.",
  },
  {
    title: "Telemetry",
    body:
      "Aggregate battle outcomes may be recorded to balance the game. Records are not sold or shared, and raw analytics events older than 90 days are pruned.",
  },
  {
    title: "Deleting your data",
    body:
      "Delete the account from /account to unlink the email and revoke sessions. The ranch and its pets remain attached to the browser unless you retire or remove them; clearing site data starts a fresh ranch.",
  },
  {
    title: "Third parties",
    body:
      "The site is hosted on Render, the database is hosted on Supabase, sign-in uses Google, and transactional email uses Resend when configured. Each processes data on this project's behalf.",
  },
];

export default function PrivacyPage() {
  return (
    <main className="mx-auto max-w-2xl px-6 py-12">
      <div className="text-[10px] uppercase tracking-[0.2em] text-muted">legal</div>
      <h1 className="font-display text-3xl">Privacy</h1>
      <p className="mt-2 text-xs leading-relaxed text-muted">
        TamaRagna is a non-commercial fan project. This page describes the data the game
        keeps and how to remove it.
      </p>

      <div className="mt-8 space-y-5">
        {SECTIONS.map((section) => (
          <section key={section.title}>
            <h2 className="font-display text-lg">{section.title}</h2>
            <p className="mt-1 text-xs leading-relaxed text-muted">{section.body}</p>
          </section>
        ))}
      </div>

      <p className="mt-10 text-[10px] text-muted/70">
        Questions: use the project repository. See{" "}
        <Link href="/" className="text-teal underline-offset-2 hover:underline">
          the ranch
        </Link>{" "}
        or{" "}
        <Link href="/account" className="text-teal underline-offset-2 hover:underline">
          your account
        </Link>
        .
      </p>
    </main>
  );
}
