import { Link } from "react-router-dom";

import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  getDeadlineInfo,
  getProgressPercent,
  progressSummary,
  quoteIsSet,
  type Order,
} from "@/lib/orders";

import { StatusBadge, ToneBadge } from "./Badges";
import { ServiceGlyph } from "./ServiceGlyph";

/**
 * A project as it appears in a list: what it is, where it stands, what happens
 * next. The full rail lives on the project's own page — a list only needs the
 * next step, not all five.
 */
export function ProjectCard({
  order,
  outputCount,
  to,
  meta,
  className,
}: {
  order: Order;
  outputCount: number;
  to: string;
  /** Extra context beside the service name — usually whose project it is. */
  meta?: string;
  className?: string;
}) {
  const percent = getProgressPercent(order, outputCount);
  const next = progressSummary(order, outputCount);
  const deadline = getDeadlineInfo(order);

  return (
    <Card
      className={cn(
        "transition-shadow duration-200 hover:shadow-raised focus-within:shadow-raised",
        className,
      )}
    >
      <Link to={to} className="block rounded-lg">
        <CardContent className="p-5">
          <div className="flex items-start gap-4">
            <span
              aria-hidden
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"
            >
              <ServiceGlyph serviceName={order.service_type} className="h-5 w-5" />
            </span>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="truncate font-display text-base font-semibold text-foreground">
                    {order.title}
                  </h3>
                  <p className="mt-0.5 truncate text-sm text-muted-foreground">
                    {order.service_type}
                    {meta ? ` — ${meta}` : ""}
                  </p>
                </div>
                <StatusBadge status={order.status} className="shrink-0" />
              </div>

              <div className="mt-4 flex flex-wrap items-center gap-2">
                {quoteIsSet(order) ? (
                  <ToneBadge tone="neutral" dot={false} className="tabular">
                    {formatCurrency(order.amount)}
                  </ToneBadge>
                ) : (
                  <ToneBadge tone="warning" dot={false}>
                    Price to be confirmed
                  </ToneBadge>
                )}
                {deadline && (
                  <ToneBadge tone={deadline.tone} dot={false} className="tabular">
                    {deadline.label}
                  </ToneBadge>
                )}
              </div>

              <div className="mt-4 space-y-1.5">
                <div className="flex items-baseline justify-between gap-3 text-xs">
                  <span className="font-medium text-foreground">{next}</span>
                  <span className="tabular text-muted-foreground">{percent}%</span>
                </div>
                <Progress value={percent} className="h-1.5" />
              </div>
            </div>
          </div>
        </CardContent>
      </Link>
    </Card>
  );
}
