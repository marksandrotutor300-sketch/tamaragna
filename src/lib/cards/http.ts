import { fail } from "@/lib/api";
import { CardRuleError } from "./engine";

export function cardError(error: unknown): Response {
  if (error instanceof CardRuleError) return fail(error.message, error.status);
  throw error;
}
