import { Link } from "react-router-dom";
import {
  BadgeCheck,
  FileDown,
  FileUp,
  ReceiptText,
  Send,
  Star,
  type LucideIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";
import {
  relativeTime,
  type ActivityItem,
  type ActivityKind,
} from "@/lib/orders";

const kindIcon: Record<ActivityKind, LucideIcon> = {
  "request-submitted": Send,
  "input-uploaded": FileUp,
  "output-uploaded": FileDown,
  "receipt-uploaded": ReceiptText,
  "payment-confirmed": BadgeCheck,
  rated: Star,
};

/**
 * One reverse-chronological feed, rendered the same way wherever it appears —
 * the client's notifications page, the admin's audit trail, and the "recent
 * updates" panels. Pass `orderLink` where a row should be clickable through to
 * the project it belongs to.
 */
export function ActivityList({
  items,
  orderLink,
  limit,
  emptyLabel = "Nothing has happened yet.",
  className,
}: {
  items: ActivityItem[];
  orderLink?: (orderId: string) => string;
  limit?: number;
  emptyLabel?: string;
  className?: string;
}) {
  const shown = limit ? items.slice(0, limit) : items;

  if (shown.length === 0) {
    return (
      <p className="px-1 py-10 text-center text-sm text-muted-foreground">
        {emptyLabel}
      </p>
    );
  }

  return (
    <ol className={cn("divide-y divide-border/70", className)}>
      {shown.map((item) => {
        const Icon = kindIcon[item.kind];
        const row = (
          <div className="flex gap-3 px-2 py-3.5">
            <span
              aria-hidden
              className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground"
            >
              <Icon className="h-4 w-4" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{item.title}</p>
              <p className="truncate text-sm text-muted-foreground">
                {item.detail}
              </p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                {relativeTime(item.at)}
                {item.orderTitle ? ` — ${item.orderTitle}` : ""}
              </p>
            </div>
          </div>
        );

        return (
          <li key={item.id}>
            {orderLink && item.orderId ? (
              <Link
                to={orderLink(item.orderId)}
                className="-mx-2 block rounded-lg transition-colors hover:bg-muted/60"
              >
                {row}
              </Link>
            ) : (
              row
            )}
          </li>
        );
      })}
    </ol>
  );
}
