import { googleConfigured } from "@/lib/auth/google";
import { SignInForm } from "./SignInForm";

export const dynamic = "force-dynamic";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return <SignInForm googleEnabled={googleConfigured()} initialError={error ?? null} />;
}
