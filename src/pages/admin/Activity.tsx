import { useMemo, useState } from "react";
import { Activity as ActivityIcon, Search } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ActivityList } from "@/components/app/ActivityList";
import { CardSection } from "@/components/app/CardSection";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/app/States";
import { useAdminData } from "@/hooks/useAdminData";
import type { ActivityKind } from "@/lib/orders";

const TABS: { value: "all" | ActivityKind; label: string }[] = [
  { value: "all", label: "Everything" },
  { value: "request-submitted", label: "Requests" },
  { value: "output-uploaded", label: "Deliveries" },
  { value: "receipt-uploaded", label: "Receipts" },
  { value: "payment-confirmed", label: "Payments" },
];

export default function Activity() {
  const { activity, loading, error, refresh } = useAdminData();
  const [tab, setTab] = useState<"all" | ActivityKind>("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return activity.filter((item) => {
      if (tab !== "all" && item.kind !== tab) return false;
      if (!q) return true;
      return (
        item.title.toLowerCase().includes(q) ||
        item.detail.toLowerCase().includes(q) ||
        (item.orderTitle ?? "").toLowerCase().includes(q)
      );
    });
  }, [activity, tab, query]);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={refresh} />;

  const countOf = (kind: ActivityKind) =>
    activity.filter((item) => item.kind === kind).length;

  return (
    <>
      <PageHeader
        title="Activity and audit"
        description="A dated record of every request, delivery, receipt and confirmation, drawn from the timestamps on the records themselves."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Requests submitted"
          value={countOf("request-submitted")}
        />
        <StatCard
          label="Files delivered"
          value={countOf("output-uploaded")}
          tone="success"
        />
        <StatCard
          label="Receipts submitted"
          value={countOf("receipt-uploaded")}
          tone="info"
        />
        <StatCard
          label="Payments confirmed"
          value={countOf("payment-confirmed")}
          tone="progress"
        />
      </div>

      <CardSection
        title="All activity"
        description="Newest first. Each entry links to the project it belongs to."
        actions={
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search activity"
              aria-label="Search activity"
              className="w-full pl-9 sm:w-64"
            />
          </div>
        }
      >
        <Tabs
          value={tab}
          onValueChange={(value) => setTab(value as "all" | ActivityKind)}
          className="mb-5"
        >
          <TabsList>
            {TABS.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {activity.length === 0 ? (
          <EmptyState
            icon={<ActivityIcon className="h-6 w-6" />}
            title="Nothing recorded yet"
            description="As clients submit requests and work moves through the pipeline, every step is dated and listed here."
          />
        ) : filtered.length === 0 ? (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No activity matches these filters.
            </p>
            <button
              type="button"
              onClick={() => {
                setQuery("");
                setTab("all");
              }}
              className="mt-4 text-sm font-medium text-brand underline-offset-4 hover:underline"
            >
              Clear filters
            </button>
          </div>
        ) : (
          <ActivityList
            items={filtered}
            orderLink={(id) => `/admin/projects?order=${id}`}
          />
        )}
      </CardSection>
    </>
  );
}
