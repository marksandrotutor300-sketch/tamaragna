import { existsSync } from "node:fs";
import { rm } from "node:fs/promises";
import net from "node:net";
import os from "node:os";
import path from "node:path";

/** Refuse to touch the database if the app is still listening. */
async function appRunning(): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.createConnection({ host: "127.0.0.1", port: 3000 });
    const finish = (value: boolean) => {
      socket.destroy();
      resolve(value);
    };
    socket.once("connect", () => finish(true));
    socket.once("error", () => finish(false));
    socket.setTimeout(500, () => finish(false));
  });
}

async function main(): Promise<void> {
  if (await appRunning()) {
    console.error("TamaRagna is running on port 3000. Stop it before unlocking the database.");
    process.exit(1);
  }

  const dataDir =
    process.env.PGLITE_DIR ?? path.join(os.homedir(), ".tamaragna", "pglite");
  const lock = path.join(dataDir, "postmaster.pid");

  if (!existsSync(lock)) {
    console.log("No PGlite lock file; nothing to do.");
    return;
  }

  await rm(lock);
  console.log(`Removed stale PGlite lock: ${lock}`);
  console.log("Only run this when no Tamaragna server or script is using the database.");
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
