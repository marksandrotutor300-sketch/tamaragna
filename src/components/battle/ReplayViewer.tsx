"use client";

import { BattleStage } from "@/components/battle/BattleStage";
import type { BattlePayload } from "@/lib/db/schema";
import type { BattleInput } from "@/lib/sim/types";

export function ReplayViewer({
  seed,
  payload,
  inputLog,
}: {
  seed: string;
  payload: BattlePayload;
  inputLog: BattleInput[];
}) {
  return (
    <BattleStage
      battleId="replay"
      seed={seed}
      payload={payload}
      mode="replay"
      inputs={inputLog}
      readOnly
    />
  );
}
