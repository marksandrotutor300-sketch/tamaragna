"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { BattleEngine } from "@/lib/sim/engine";
import type {
  BattleConfig,
  BattleEvent,
  BattleInput,
  BattleResult,
  SideSnapshot,
} from "@/lib/sim/types";

export type BattleSnapshotPair = { a: SideSnapshot; b: SideSnapshot };

export type BattleRunner = {
  snapshot: BattleSnapshotPair | null;
  events: BattleEvent[];
  lastBatch: BattleEvent[];
  finished: boolean;
  result: BattleResult | null;
  paused: boolean;
  speed: number;
  timeMs: number;
  pressSkill: (slot: number) => void;
  swap: (index: number) => void;
  setPaused: (value: boolean) => void;
  setSpeed: (value: number) => void;
  getInputLog: () => BattleInput[];
};

export function useBattleRunner(config: {
  seed: string;
  teamA: BattleConfig["teamA"];
  teamB: BattleConfig["teamB"];
  ai: BattleConfig["ai"];
  maxMs?: number;
  inputs?: BattleInput[];
}): BattleRunner {
  const engineRef = useRef<BattleEngine | null>(null);
  const [snapshot, setSnapshot] = useState<BattleSnapshotPair | null>(null);
  const [events, setEvents] = useState<BattleEvent[]>([]);
  const [lastBatch, setLastBatch] = useState<BattleEvent[]>([]);
  const [finished, setFinished] = useState(false);
  const [result, setResult] = useState<BattleResult | null>(null);
  const [paused, setPausedState] = useState(false);
  const [speed, setSpeedState] = useState(1);
  const [timeMs, setTimeMs] = useState(0);

  const pausedRef = useRef(false);
  const speedRef = useRef(1);
  const eventsRef = useRef<BattleEvent[]>([]);

  pausedRef.current = paused;
  speedRef.current = speed;

  useEffect(() => {
    const engine = new BattleEngine({
      seed: config.seed,
      teamA: config.teamA,
      teamB: config.teamB,
      ai: config.ai,
      maxMs: config.maxMs,
      inputs: config.inputs,
    });
    engineRef.current = engine;
    setSnapshot(engine.snapshot());
    setFinished(false);
    setResult(null);
    setEvents([]);
    eventsRef.current = [];

    let raf = 0;
    let last = performance.now();
    let lastRender = 0;
    let running = true;

    const loop = (now: number) => {
      if (!running) return;
      const delta = Math.min(250, now - last) * speedRef.current;
      last = now;

      if (!pausedRef.current) {
        const produced = engine.step(delta);
        if (produced.length > 0) {
          eventsRef.current = [...eventsRef.current, ...produced].slice(-200);
          setEvents(eventsRef.current);
          setLastBatch(produced);
        }

        if (now - lastRender > 40) {
          lastRender = now;
          setSnapshot(engine.snapshot());
          setTimeMs(engine.currentTime);
        }

        if (engine.finished) {
          setSnapshot(engine.snapshot());
          setTimeMs(engine.currentTime);
          setResult(engine.result);
          setFinished(true);
          return;
        }
      }

      raf = requestAnimationFrame(loop);
    };

    raf = requestAnimationFrame(loop);
    return () => {
      running = false;
      cancelAnimationFrame(raf);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.seed]);

  const pressSkill = useCallback((slot: number) => {
    engineRef.current?.pressSkill(slot);
  }, []);

  const swap = useCallback((index: number) => {
    engineRef.current?.swap(index);
  }, []);

  const getInputLog = useCallback(() => {
    return [...(engineRef.current?.inputLog ?? [])];
  }, []);

  const setPaused = useCallback((value: boolean) => {
    pausedRef.current = value;
    setPausedState(value);
  }, []);

  const setSpeed = useCallback((value: number) => {
    speedRef.current = value;
    setSpeedState(value);
  }, []);

  return {
    snapshot,
    events,
    lastBatch,
    finished,
    result,
    paused,
    speed,
    timeMs,
    pressSkill,
    swap,
    setPaused,
    setSpeed,
    getInputLog,
  };
}
