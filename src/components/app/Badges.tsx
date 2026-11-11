import type { ReactNode } from "react";
import { cn } from "@/lib/utils";
import type { OrderStatus, Tone } from "@/lib/orders";
import { STATUS_LABEL, STATUS_TONE } from "@/lib/orders";

/**
 * One vocabulary for colour across the whole product. Navy carries structure;
 * these tints are only ever used to say something about state.
 */
const toneClasses: Record<Tone, string> = {
  neutral: "border-border bg-muted text-muted-foreground",
  info: "border-brand/25 bg-brand-muted text-brand",
  progress: "border-primary/20 bg-accent text-accent-foreground",
  success: "border-success/25 bg-success-muted text-success",
  warning: "border-warning/25 bg-warning-muted text-warning",
  danger: "border-destructive/25 bg-destructive-muted text-destructive",
};

const toneDot: Record<Tone, string> = {
  neutral: "bg-muted-foreground/60",
  info: "bg-brand",
  progress: "bg-primary",
  success: "bg-success",
  warning: "bg-warning",
  danger: "bg-destructive",
};

export function ToneBadge({
  tone = "neutral",
  children,
  className,
  dot = true,
}: {
  tone?: Tone;
  children: ReactNode;
  className?: string;
  dot?: boolean;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        toneClasses[tone],
        className,
      )}
    >
      {dot && (
        <span
          aria-hidden
          className={cn("h-1.5 w-1.5 shrink-0 rounded-full", toneDot[tone])}
        />
      )}
      {children}
    </span>
  );
}

export function StatusBadge({
  status,
  className,
}: {
  status: OrderStatus;
  className?: string;
}) {
  return (
    <ToneBadge tone={STATUS_TONE[status]} className={className}>
      {STATUS_LABEL[status]}
    </ToneBadge>
  );
}

/** A quiet marker that carries no state — used for counts and labels. */
export function Pill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-border bg-card px-2.5 py-0.5 text-xs font-medium text-muted-foreground",
        className,
      )}
    >
      {children}
    </span>
  );
}
