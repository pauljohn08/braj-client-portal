import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Milestone, MilestoneState } from "@/lib/orders";

/**
 * The signature device of the portal: a staged rail showing exactly how far an
 * engagement has progressed. The stages are a genuine sequence (request, quote,
 * work, delivery, settlement), which is why they are marked as steps.
 *
 * Desktop lays the rail out horizontally; narrow screens use the same markup
 * vertically so the sequence is never implied by colour alone.
 */

function Marker({ state, index }: { state: MilestoneState; index: number }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative z-10 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border-2 text-[11px] font-semibold transition-colors",
        state === "done" && "border-primary bg-primary text-primary-foreground",
        state === "current" &&
          "border-primary bg-card text-primary ring-4 ring-primary/10",
        state === "upcoming" && "border-border bg-card text-muted-foreground",
      )}
    >
      {state === "done" ? <Check className="h-3.5 w-3.5" /> : index + 1}
    </span>
  );
}

export function MilestoneRail({
  milestones,
  className,
}: {
  milestones: Milestone[];
  className?: string;
}) {
  const doneCount = milestones.filter((m) => m.state === "done").length;
  const total = milestones.length;
  const fillPercent =
    doneCount <= 1 ? 0 : ((doneCount - 1) / (total - 1)) * 100;
  const current =
    milestones.find((m) => m.state === "current") ?? milestones[total - 1];

  return (
    <div className={cn("space-y-5", className)}>
      {/* Wide screens: a single horizontal rail */}
      <div className="relative hidden md:block">
        <div
          aria-hidden
          className="absolute left-[10%] right-[10%] top-3 h-0.5 -translate-y-1/2 overflow-hidden rounded-full bg-border"
        >
          <div
            className="h-full rounded-full bg-primary transition-[width] duration-500 ease-out"
            style={{ width: `${fillPercent}%` }}
          />
        </div>
        <ol className="relative grid grid-cols-5 gap-2">
          {milestones.map((m, i) => (
            <li
              key={m.key}
              aria-current={m.state === "current" ? "step" : undefined}
              className="flex flex-col items-center gap-2 text-center"
            >
              <Marker state={m.state} index={i} />
              <span
                className={cn(
                  "text-xs leading-snug",
                  m.state === "upcoming"
                    ? "text-muted-foreground"
                    : "font-semibold text-foreground",
                )}
              >
                {m.label}
              </span>
            </li>
          ))}
        </ol>
      </div>

      {/* Narrow screens: the same sequence, read top to bottom */}
      <ol className="space-y-0 md:hidden">
        {milestones.map((m, i) => (
          <li
            key={m.key}
            aria-current={m.state === "current" ? "step" : undefined}
            className="flex gap-3"
          >
            <div className="flex flex-col items-center">
              <Marker state={m.state} index={i} />
              {i < total - 1 && (
                <span
                  aria-hidden
                  className={cn(
                    "w-0.5 flex-1",
                    m.state === "done" ? "bg-primary" : "bg-border",
                  )}
                />
              )}
            </div>
            <div className={cn("pb-5", i === total - 1 && "pb-0")}>
              <p
                className={cn(
                  "text-sm leading-snug",
                  m.state === "upcoming"
                    ? "text-muted-foreground"
                    : "font-semibold text-foreground",
                )}
              >
                {m.label}
              </p>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {m.detail}
              </p>
            </div>
          </li>
        ))}
      </ol>

      {/* The one thing the client most wants to know, in a sentence. */}
      <p className="hidden border-t border-border/70 pt-4 text-sm leading-relaxed text-muted-foreground md:block">
        <span className="font-semibold text-foreground">
          {doneCount} of {total} steps complete.
        </span>{" "}
        {current.detail}
      </p>
    </div>
  );
}
