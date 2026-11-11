import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import type { Tone } from "@/lib/orders";

const toneText: Record<Tone, string> = {
  neutral: "text-foreground",
  info: "text-brand",
  progress: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
};

/**
 * A quiet count tile. The numeral is deliberately not display-sized — these are
 * supporting figures, not the point of the page. When a tile links somewhere it
 * lifts on hover; otherwise it stays flat.
 */
export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = "neutral",
  to,
  className,
}: {
  label: string;
  value: ReactNode;
  hint?: string;
  icon?: ReactNode;
  tone?: Tone;
  to?: string;
  className?: string;
}) {
  const inner = (
    <CardContent className="p-5">
      <div className="flex items-start justify-between gap-3">
        <span className="text-sm font-medium text-muted-foreground">{label}</span>
        {icon && (
          <span
            aria-hidden
            className={cn(
              "shrink-0",
              tone === "neutral" ? "text-muted-foreground" : toneText[tone],
            )}
          >
            {icon}
          </span>
        )}
      </div>
      <div
        className={cn(
          "tabular mt-3 font-display text-3xl font-semibold tracking-tight",
          toneText[tone],
        )}
      >
        {value}
      </div>
      {hint && (
        <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">
          {hint}
        </p>
      )}
    </CardContent>
  );

  if (to) {
    return (
      <Card
        className={cn(
          "group transition-shadow duration-200 hover:shadow-raised focus-within:shadow-raised",
          className,
        )}
      >
        <Link
          to={to}
          className="block rounded-lg focus-visible:outline-none [&:focus-visible]:outline-none"
        >
          {inner}
        </Link>
      </Card>
    );
  }

  return <Card className={className}>{inner}</Card>;
}
