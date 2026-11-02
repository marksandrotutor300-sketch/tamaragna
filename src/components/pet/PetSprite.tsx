"use client";

import { useState } from "react";
import { cn } from "@/lib/client/cn";
import type { MobAction } from "@/lib/assets/providers";

export type SpriteAction = MobAction;

export function PetSprite({
  speciesId,
  action = "idle",
  size = 96,
  className,
  animate = true,
  alt = "",
  animation,
  priority = false,
  style,
}: {
  speciesId: number;
  action?: SpriteAction;
  size?: number;
  className?: string;
  animate?: boolean;
  alt?: string;
  animation?: "idle" | "attack" | "hurt" | "dead" | "none";
  /** eager-load above-the-fold sprites; everything else defers */
  priority?: boolean;
  style?: React.CSSProperties;
}) {
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");

  const animationClass =
    animation === "attack"
      ? "sprite-attack"
      : animation === "hurt"
        ? "sprite-hurt"
        : animation === "dead"
          ? "sprite-dead"
          : animation === "none"
            ? ""
            : animate
              ? "sprite-idle"
              : "";

  return (
    <div
      className={cn("relative shrink-0", className)}
      style={{ width: size, height: size, ...style }}
    >
      {status === "loading" ? (
        <div className="absolute inset-1 animate-pulse rounded-lg bg-white/[0.04]" />
      ) : null}

      {status === "error" ? (
        <div
          className="flex h-full w-full items-center justify-center rounded-xl border border-line/60 bg-black/20 font-display text-muted"
          style={{ fontSize: Math.max(12, size * 0.28) }}
          aria-label="sprite unavailable"
        >
          ?
        </div>
      ) : (
        <img
          src={`/api/sprite/${speciesId}?action=${action}`}
          alt={alt}
          width={size}
          height={size}
          draggable={false}
          loading={priority ? "eager" : "lazy"}
          decoding="async"
          onLoad={() => setStatus("ready")}
          onError={() => setStatus("error")}
          className={cn(
            "pixel h-full w-full select-none object-contain sprite-shadow transition-opacity duration-300",
            animationClass,
            status === "ready" ? "opacity-100" : "opacity-0",
          )}
        />
      )}
    </div>
  );
}
