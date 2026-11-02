import type { ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/client/cn";

export function Panel({
  className,
  children,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("panel p-4", className)} {...props}>
      {children}
    </div>
  );
}

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "ghost" | "danger" | "gold";
  size?: "sm" | "md" | "lg";
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-xl font-medium transition",
        "disabled:cursor-not-allowed disabled:opacity-40",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal/70",
        size === "sm" && "px-3 py-1.5 text-xs",
        size === "md" && "px-4 py-2.5 text-sm",
        size === "lg" && "px-6 py-3.5 text-base",
        variant === "primary" &&
          "bg-teal text-[#04211d] hover:bg-teal/90 active:translate-y-px shadow-[0_10px_30px_-12px_rgba(58,215,192,.8)]",
        variant === "gold" &&
          "bg-gold text-[#241a02] hover:bg-gold/90 active:translate-y-px shadow-[0_10px_30px_-12px_rgba(255,201,74,.8)]",
        variant === "ghost" &&
          "border border-line/80 bg-panel-2/60 text-ink hover:border-teal/50 hover:bg-panel-2",
        variant === "danger" &&
          "border border-rose/30 bg-rose/10 text-rose hover:bg-rose/20",
        className,
      )}
      {...props}
    />
  );
}

export function Pill({
  className,
  children,
  color,
}: {
  className?: string;
  children: React.ReactNode;
  color?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-white/10 px-2 py-0.5 text-[11px] font-medium",
        className,
      )}
      style={color ? { color, borderColor: `${color}55`, background: `${color}12` } : undefined}
    >
      {children}
    </span>
  );
}

export function Bar({
  value,
  max,
  color = "#3ad7c0",
  className,
  height = 6,
}: {
  value: number;
  max: number;
  color?: string;
  className?: string;
  height?: number;
}) {
  const pct = max > 0 ? Math.max(0, Math.min(100, (value / max) * 100)) : 0;
  return (
    <div
      className={cn("w-full overflow-hidden rounded-full bg-black/40", className)}
      style={{ height }}
    >
      <div
        className="h-full rounded-full transition-[width] duration-300"
        style={{
          width: `${pct}%`,
          background: `linear-gradient(90deg, ${color}cc, ${color})`,
          boxShadow: `0 0 12px ${color}66`,
        }}
      />
    </div>
  );
}

export function Stat({
  label,
  value,
  sub,
  accent,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
  accent?: string;
}) {
  return (
    <div className="rounded-xl border border-line/60 bg-black/20 px-3 py-2">
      <div className="text-[10px] uppercase tracking-[0.14em] text-muted">{label}</div>
      <div className="mt-0.5 font-display text-lg leading-none" style={{ color: accent }}>
        {value}
      </div>
      {sub ? <div className="mt-1 text-[10px] text-muted">{sub}</div> : null}
    </div>
  );
}

export function SectionTitle({
  children,
  hint,
}: {
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div className="mb-3 flex items-end justify-between gap-3">
      <h2 className="font-display text-lg text-ink">{children}</h2>
      {hint ? <span className="text-xs text-muted">{hint}</span> : null}
    </div>
  );
}

export function Spinner({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent",
        className,
      )}
    />
  );
}

export function EmptyState({
  title,
  body,
  action,
}: {
  title: string;
  body: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-line/80 px-6 py-12 text-center">
      <div className="font-display text-lg">{title}</div>
      <p className="max-w-sm text-sm text-muted">{body}</p>
      {action}
    </div>
  );
}
