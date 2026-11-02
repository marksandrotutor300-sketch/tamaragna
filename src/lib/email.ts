import { logEvent } from "@/lib/log";

export type EmailDelivery = "sent" | "logged";

/**
 * Resend-backed magic-link delivery. Without RESEND_API_KEY the link is logged
 * so local development and tests can complete the flow.
 */
export async function sendMagicLink(
  email: string,
  url: string,
): Promise<EmailDelivery> {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;

  if (!apiKey || !from) {
    logEvent("info", "email.magic_link_dev", { email, url });
    return "logged";
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject: "Sign in to TamaRagna",
      text: `Open this link to sign in to TamaRagna. It expires in 15 minutes.\n\n${url}\n\nIf you did not request this, ignore the email.`,
      html: `<p>Open this link to sign in to TamaRagna. It expires in 15 minutes.</p><p><a href="${url}">Sign in</a></p><p>If you did not request this, ignore the email.</p>`,
    }),
  });

  if (!response.ok) {
    throw new Error(`Email provider returned ${response.status}`);
  }

  return "sent";
}
