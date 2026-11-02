import { mkdir, readFile, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import path from "node:path";
import { RATHENA_DATA_FILES, RATHENA_REPO, RATHENA_SHA } from "./rathena.pin";

const CACHE_ROOT = path.join(process.cwd(), ".cache", "rathena", RATHENA_SHA);
const RAW_BASE = `https://raw.githubusercontent.com/${RATHENA_REPO}/${RATHENA_SHA}`;
const TREE_URL = `https://api.github.com/repos/${RATHENA_REPO}/git/trees/${RATHENA_SHA}?recursive=1`;

type TreeEntry = { path: string; type: string };

const force = process.argv.includes("--force");

function cachePath(remotePath: string): string {
  return path.join(CACHE_ROOT, remotePath);
}

async function download(remotePath: string): Promise<void> {
  const target = cachePath(remotePath);
  if (!force && existsSync(target)) return;

  const url = `${RAW_BASE}/${remotePath.split("/").map(encodeURIComponent).join("/")}`;
  const res = await fetch(url, { headers: { "User-Agent": "tamaragna-datapipeline" } });
  if (!res.ok) {
    throw new Error(`Failed to fetch ${remotePath}: ${res.status} ${res.statusText}`);
  }
  const body = Buffer.from(await res.arrayBuffer());
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, body);
  process.stdout.write(`  fetched ${remotePath} (${body.length.toLocaleString()} bytes)\n`);
}

async function listSpawnFiles(): Promise<string[]> {
  const res = await fetch(TREE_URL, {
    headers: {
      "User-Agent": "tamaragna-datapipeline",
      Accept: "application/vnd.github+json",
    },
  });
  if (!res.ok) {
    throw new Error(`Failed to list rAthena tree: ${res.status} ${res.statusText}`);
  }
  const json = (await res.json()) as { tree: TreeEntry[]; truncated: boolean };
  if (json.truncated) {
    throw new Error("rAthena tree listing was truncated; refusing to continue");
  }
  return json.tree
    .filter(
      (entry) =>
        entry.type === "blob" &&
        entry.path.startsWith("npc/re/mobs/") &&
        entry.path.endsWith(".txt"),
    )
    .map((entry) => entry.path)
    .sort();
}

async function main(): Promise<void> {
  console.log(`Fetching rAthena ${RATHENA_SHA.slice(0, 12)} into ${CACHE_ROOT}`);
  await mkdir(CACHE_ROOT, { recursive: true });

  for (const file of RATHENA_DATA_FILES) {
    await download(file);
  }

  const spawnFiles = await listSpawnFiles();
  console.log(`Spawn scripts: ${spawnFiles.length}`);
  for (const file of spawnFiles) {
    await download(file);
  }

  const manifest = {
    repo: RATHENA_REPO,
    sha: RATHENA_SHA,
    fetchedAt: new Date().toISOString(),
    dataFiles: RATHENA_DATA_FILES,
    spawnFiles,
  };
  await writeFile(
    path.join(CACHE_ROOT, "fetch-manifest.json"),
    `${JSON.stringify(manifest, null, 2)}\n`,
  );
  console.log(`Done. Manifest written to ${path.join(CACHE_ROOT, "fetch-manifest.json")}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

export async function readCached(remotePath: string): Promise<string> {
  return readFile(cachePath(remotePath), "utf8");
}
