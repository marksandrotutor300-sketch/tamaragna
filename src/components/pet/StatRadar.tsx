"use client";

import { ivGrade } from "@/lib/game/rarity";

const LABELS = ["STR", "AGI", "VIT", "INT", "DEX", "LUK"] as const;
const KEYS = ["str", "agi", "vit", "int", "dex", "luk"] as const;

export function StatRadar({
  ivs,
  size = 190,
}: {
  ivs: Record<(typeof KEYS)[number], number>;
  size?: number;
}) {
  const radius = size / 2 - 26;
  const center = size / 2;
  const max = 31;

  const point = (index: number, value: number) => {
    const angle = (Math.PI * 2 * index) / 6 - Math.PI / 2;
    const r = (value / max) * radius;
    return [center + Math.cos(angle) * r, center + Math.sin(angle) * r] as const;
  };

  const polygon = KEYS.map((key, index) => point(index, ivs[key]))
    .map(([x, y]) => `${x},${y}`)
    .join(" ");

  const rings = [0.33, 0.66, 1];

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label="Individual values">
      {rings.map((ring) => (
        <polygon
          key={ring}
          points={KEYS.map((_, index) => point(index, max * ring)).map(([x, y]) => `${x},${y}`).join(" ")}
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth={1}
        />
      ))}
      {KEYS.map((_, index) => {
        const [x, y] = point(index, max);
        return (
          <line
            key={index}
            x1={center}
            y1={center}
            x2={x}
            y2={y}
            stroke="rgba(255,255,255,0.06)"
            strokeWidth={1}
          />
        );
      })}
      <polygon points={polygon} fill="rgba(58,215,192,0.22)" stroke="#3ad7c0" strokeWidth={2} />
      {KEYS.map((key, index) => {
        const [x, y] = point(index, max + 8);
        return (
          <text
            key={key}
            x={x}
            y={y + 3}
            textAnchor="middle"
            fontSize={9}
            fill={ivs[key] >= 22 ? "#ffc94a" : "#8b9cb3"}
            fontFamily="var(--font-body)"
          >
            {LABELS[index]} {ivGrade(ivs[key])}
          </text>
        );
      })}
      {KEYS.map((key, index) => {
        const [x, y] = point(index, ivs[key]);
        return <circle key={key} cx={x} cy={y} r={2.5} fill="#3ad7c0" />;
      })}
    </svg>
  );
}

export function IvPips({ ivs }: { ivs: Record<(typeof KEYS)[number], number> }) {
  return (
    <div className="grid grid-cols-3 gap-2">
      {KEYS.map((key, index) => (
        <div key={key} className="rounded-lg border border-line/60 bg-black/20 px-2 py-1.5">
          <div className="flex items-center justify-between text-[10px] text-muted">
            <span>{LABELS[index]}</span>
            <span className={ivs[key] >= 22 ? "text-gold" : "text-ink"}>{ivs[key]}</span>
          </div>
          <div className="mt-1 flex gap-0.5">
            {Array.from({ length: 10 }).map((_, pip) => (
              <span
                key={pip}
                className="h-1 flex-1 rounded-full"
                style={{
                  background:
                    ivs[key] / 31 > pip / 10
                      ? ivs[key] >= 22
                        ? "#ffc94a"
                        : "#3ad7c0"
                      : "rgba(255,255,255,0.08)",
                }}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
