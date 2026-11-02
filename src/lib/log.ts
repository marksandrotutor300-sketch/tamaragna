type Level = "info" | "warn" | "error";

export function logEvent(
  level: Level,
  event: string,
  context: Record<string, unknown> = {},
): void {
  const line = JSON.stringify({
    ts: new Date().toISOString(),
    level,
    event,
    ...context,
  });
  if (level === "error") console.error(line);
  else if (level === "warn") console.warn(line);
  else console.info(line);
}
