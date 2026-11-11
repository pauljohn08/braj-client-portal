import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FolderKanban, Plus, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSection } from "@/components/app/CardSection";
import { PageHeader } from "@/components/app/PageHeader";
import { ProjectCard } from "@/components/app/ProjectCard";
import { StatCard } from "@/components/app/StatCard";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/app/States";
import { useClientData } from "@/hooks/useClientData";
import { formatCurrency } from "@/lib/orders";

const TABS = [
  { value: "active", label: "Active" },
  { value: "delivered", label: "Delivered" },
  { value: "all", label: "All projects" },
];

export default function Projects() {
  const { orders, outputCounts, loading, error, refresh } = useClientData();
  const [query, setQuery] = useState("");
  const [tab, setTab] = useState("active");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      const settled = order.status === "completed" && order.payment_received;
      if (tab === "active" && settled) return false;
      if (tab === "delivered" && order.status !== "completed") return false;
      if (!q) return true;
      return (
        order.title.toLowerCase().includes(q) ||
        order.service_type.toLowerCase().includes(q) ||
        order.pricing_tier.toLowerCase().includes(q)
      );
    });
  }, [orders, query, tab]);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={refresh} />;

  const inProgress = orders.filter((order) => order.status === "in_progress");
  const delivered = orders.filter((order) => order.status === "completed");
  const committed = orders
    .filter((order) => order.status !== "pending")
    .reduce((sum, order) => sum + Number(order.amount ?? 0), 0);

  return (
    <>
      <PageHeader
        title="My projects"
        description="Every request you have sent us, and how far each one has come."
        actions={
          <Button asChild>
            <Link to="/order">
              <Plus className="h-4 w-4" />
              Submit a request
            </Link>
          </Button>
        }
      />

      {orders.length > 0 && (
        <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="All projects" value={orders.length} />
          <StatCard label="In progress" value={inProgress.length} tone="progress" />
          <StatCard label="Delivered" value={delivered.length} tone="success" />
          <StatCard
            label="Total agreed"
            value={formatCurrency(committed)}
            hint="Across everything priced so far."
          />
        </div>
      )}

      <CardSection
        title="All projects"
        description="Select a project to see its full progress, files and payment."
        actions={
          <div className="relative">
            <Search
              aria-hidden
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
            />
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              aria-label="Search projects"
              className="w-full pl-9 sm:w-64"
            />
          </div>
        }
      >
        <Tabs value={tab} onValueChange={setTab} className="mb-5">
          <TabsList>
            {TABS.map((item) => (
              <TabsTrigger key={item.value} value={item.value}>
                {item.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {filtered.length > 0 ? (
          <div className="space-y-4">
            {filtered.map((order) => (
              <ProjectCard
                key={order.id}
                order={order}
                outputCount={outputCounts.get(order.id) ?? 0}
                to={`/dashboard/projects/${order.id}`}
              />
            ))}
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<FolderKanban className="h-6 w-6" />}
            title="No projects yet"
            description="Send us your first request. You will be able to follow it here from review through to delivery."
            action={
              <Button asChild>
                <Link to="/order">
                  <Plus className="h-4 w-4" />
                  Submit a request
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No projects match this view.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setQuery("");
                setTab("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </CardSection>
    </>
  );
}
