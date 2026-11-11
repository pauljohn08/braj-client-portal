import type { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

/**
 * A titled panel. Used everywhere a page groups content so headings, spacing
 * and the rule under the title stay identical across the product.
 */
export function CardSection({
  title,
  description,
  actions,
  children,
  className,
  contentClassName,
  as: Heading = "h2",
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
  as?: "h2" | "h3";
}) {
  return (
    <Card className={cn("overflow-hidden", className)}>
      <div className="flex flex-wrap items-start justify-between gap-3 border-b border-border/70 bg-muted/40 px-5 py-4">
        <div className="min-w-0">
          <Heading className="font-display text-base font-semibold tracking-tight text-foreground">
            {title}
          </Heading>
          {description && (
            <p className="mt-0.5 text-sm leading-relaxed text-muted-foreground">
              {description}
            </p>
          )}
        </div>
        {actions && (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        )}
      </div>
      <CardContent className={cn("p-5", contentClassName)}>{children}</CardContent>
    </Card>
  );
}
