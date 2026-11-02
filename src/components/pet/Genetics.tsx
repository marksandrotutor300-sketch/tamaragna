import { Star } from "lucide-react";
import { cn } from "@/lib/client/cn";
import { MAX_STAR } from "@/lib/game/awakening";
import { natureById, type NatureId } from "@/lib/game/nature";

export function StarPips({ star, className }: { star: number; className?: string }) {
  const filled = Math.max(1, Math.min(MAX_STAR, Math.round(star)));

  return (
    <span
      className={cn("inline-flex items-center gap-0.5", className)}
      aria-label={`${filled} of ${MAX_STAR} stars`}
      title={`${filled} of ${MAX_STAR} stars`}
    >
      {Array.from({ length: MAX_STAR }).map((_, index) => (
        <Star
          key={index}
          className={cn("h-3 w-3", index < filled ? "text-gold" : "text-muted/40")}
          fill={index < filled ? "currentColor" : "none"}
          strokeWidth={1.5}
        />
      ))}
    </span>
  );
}

export function NatureBadge({ nature, className }: { nature: NatureId; className?: string }) {
  const info = natureById(nature);
  const neutral = !info.up && !info.down;

  return (
    <span
      title={info.description}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px]",
        neutral
          ? "border-line/60 text-muted"
          : "border-violet/40 bg-violet/10 text-violet",
        className,
      )}
    >
      {info.name}
    </span>
  );
}
