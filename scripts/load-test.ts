const base = process.env.BASE_URL ?? "http://localhost:3000";
export {};
const targets = ["/api/health", "/api/bestiary?page=1", "/api/featured"];
const total = Number(process.env.LOAD_REQUESTS ?? 200);
const concurrency = Number(process.env.LOAD_CONCURRENCY ?? 10);

type Result = { ms: number; ok: boolean };

async function hit(path: string): Promise<Result> {
  const start = performance.now();
  try {
    const response = await fetch(`${base}${path}`, {
      headers: { "User-Agent": "tamaragna-load-test" },
    });
    await response.arrayBuffer();
    return { ms: performance.now() - start, ok: response.ok };
  } catch {
    return { ms: performance.now() - start, ok: false };
  }
}

async function run(path: string): Promise<number> {
  for (let index = 0; index < 5; index += 1) {
    await hit(path);
  }

  const results: Result[] = [];
  let cursor = 0;

  const workers = Array.from({ length: concurrency }, async () => {
    while (true) {
      const index = cursor;
      cursor += 1;
      if (index >= total) return;
      results.push(await hit(path));
    }
  });

  await Promise.all(workers);

  const times = results.map((result) => result.ms).sort((a, b) => a - b);
  const errors = results.filter((result) => !result.ok).length;
  const percentile = (p: number) =>
    times[Math.min(times.length - 1, Math.floor((p / 100) * times.length))] ?? 0;
  const max = times[times.length - 1] ?? 0;

  console.log(
    `${path.padEnd(32)} n=${String(results.length).padStart(3)} ` +
      `p50=${percentile(50).toFixed(0).padStart(4)}ms ` +
      `p95=${percentile(95).toFixed(0).padStart(4)}ms ` +
      `max=${max.toFixed(0).padStart(4)}ms errors=${errors}`,
  );

  return errors;
}

async function main(): Promise<void> {
  console.log(`Load test against ${base} (${total} requests, concurrency ${concurrency})`);
  let errors = 0;
  for (const target of targets) {
    errors += await run(target);
  }
  if (errors > 0) {
    console.error(`${errors} request(s) failed`);
    process.exit(1);
  }
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
