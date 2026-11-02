import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readFile } from "node:fs/promises";
import path from "node:path";

const GENERATED = path.join(process.cwd(), "data", "generated", "species.json");
const EVOLUTION = path.join(process.cwd(), "data", "generated", "evolution.json");
const EXPECTED_SKILLS = 6;

function run(script: string): void {
  const result = spawnSync("npx", ["tsx", script], {
    stdio: "inherit",
    shell: process.platform === "win32",
    cwd: process.cwd(),
  });
  if (result.status !== 0) {
    console.error(`Failed to run ${script}`);
    process.exit(result.status ?? 1);
  }
}

async function needsBuild(): Promise<boolean> {
  if (!existsSync(GENERATED)) return true;

  try {
    const species = JSON.parse(await readFile(GENERATED, "utf8")) as Array<{
      skills?: unknown[];
      playable?: boolean;
    }>;
    const sample = species.find((entry) => entry.playable) ?? species[0];
    return !sample || !Array.isArray(sample.skills) || sample.skills.length !== EXPECTED_SKILLS;
  } catch {
    return true;
  }
}

async function main(): Promise<void> {
  if (await needsBuild()) {
    console.log("Game data missing or outdated, generating from rAthena...");
    run("scripts/fetch-rathena.ts");
    run("scripts/build-bestiary.ts");
  } else {
    console.log("Game data present.");
  }

  if (!existsSync(EVOLUTION)) {
    run("scripts/build-evolution.ts");
  }
}

void main();
