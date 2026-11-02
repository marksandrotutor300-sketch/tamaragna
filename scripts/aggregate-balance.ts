import { recomputeBalance } from "../src/lib/game/balance";

async function main(): Promise<void> {
  const result = await recomputeBalance();
  console.log(
    `Aggregated ${result.events} battle events into ${result.rows} balance rows`,
  );
  process.exit(0);
}

void main().catch((error) => {
  console.error(error);
  process.exit(1);
});
