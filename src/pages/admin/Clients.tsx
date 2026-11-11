import { useMemo, useState } from "react";
import { Search, Users } from "lucide-react";

import { CardSection } from "@/components/app/CardSection";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { StatusBadge, ToneBadge } from "@/components/app/Badges";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/app/States";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAdminData } from "@/hooks/useAdminData";
import { cn } from "@/lib/utils";
import { formatCurrency, formatDate } from "@/lib/orders";

function initialsOf(name: string): string {
  return (
    name
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?"
  );
}

export default function Clients() {
  const { clients, orders, loading, error, refresh } = useAdminData();
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return clients;
    return clients.filter((client) =>
      [client.name, client.email, client.phone, client.gcashNumber]
        .filter(Boolean)
        .some((value) => value!.toLowerCase().includes(q)),
    );
  }, [clients, query]);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={refresh} />;

  const selected =
    clients.find((client) => client.userId === selectedId) ?? filtered[0] ?? null;
  const selectedOrders = selected
    ? orders.filter((order) => order.user_id === selected.userId)
    : [];

  const withWork = clients.filter((client) => client.activeCount > 0).length;
  const billed = clients.reduce((sum, client) => sum + client.billedTotal, 0);
  const settled = clients.reduce((sum, client) => sum + client.settledTotal, 0);

  return (
    <>
      <PageHeader
        title="Clients"
        description="Everyone who has placed a request, and where each account stands."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Clients" value={clients.length} />
        <StatCard label="With work in flight" value={withWork} tone="progress" />
        <StatCard label="Billed to date" value={formatCurrency(billed)} />
        <StatCard label="Settled" value={formatCurrency(settled)} tone="success" />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]">
        <CardSection
          title="All clients"
          description="Select a client to see their account."
          actions={
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search clients"
                aria-label="Search clients"
                className="w-full pl-9 sm:w-56"
              />
            </div>
          }
          className="lg:col-span-1"
        >
          {clients.length === 0 ? (
            <EmptyState
              icon={<Users className="h-6 w-6" />}
              title="No clients yet"
              description="A client appears here as soon as they submit their first request."
            />
          ) : filtered.length === 0 ? (
            <p className="py-8 text-center text-sm text-muted-foreground">
              No clients match that search.
            </p>
          ) : (
            <ul className="space-y-1.5">
              {filtered.map((client) => {
                const isSelected = selected?.userId === client.userId;
                return (
                  <li key={client.userId}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(client.userId)}
                      aria-current={isSelected ? "true" : undefined}
                      className={cn(
                        "flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors",
                        isSelected ? "bg-muted/60" : "hover:bg-muted/40",
                      )}
                    >
                      <span
                        aria-hidden
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground"
                      >
                        {initialsOf(client.name)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-foreground">
                          {client.name}
                        </span>
                        <span className="block truncate text-xs text-muted-foreground">
                          {client.email}
                        </span>
                      </span>
                      <span className="tabular shrink-0 text-xs text-muted-foreground">
                        {client.orderCount}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </CardSection>

        {selected ? (
          <div className="space-y-6">
            <CardSection
              title={selected.name}
              description={selected.email}
            >
              <dl className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <dt className="text-sm text-muted-foreground">Phone</dt>
                  <dd className="tabular mt-1 font-medium text-foreground">
                    {selected.phone || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">GCash number</dt>
                  <dd className="tabular mt-1 font-medium text-foreground">
                    {selected.gcashNumber || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">GCash name</dt>
                  <dd className="mt-1 font-medium text-foreground">
                    {selected.gcashName || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Billed</dt>
                  <dd className="tabular mt-1 font-medium text-foreground">
                    {formatCurrency(selected.billedTotal)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Settled</dt>
                  <dd className="tabular mt-1 font-medium text-foreground">
                    {formatCurrency(selected.settledTotal)}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Last order</dt>
                  <dd className="tabular mt-1 font-medium text-foreground">
                    {formatDate(selected.lastOrderAt)}
                  </dd>
                </div>
              </dl>
            </CardSection>

            <CardSection
              title="Their projects"
              description={`${selected.orderCount} in total — ${selected.activeCount} active, ${selected.completedCount} completed.`}
              contentClassName="p-0"
            >
              {selectedOrders.length === 0 ? (
                <p className="p-5 text-sm text-muted-foreground">
                  This client has no projects yet.
                </p>
              ) : (
                <div className="overflow-x-auto px-5 pb-5">
                  <Table>
                    <TableCaption className="sr-only">
                      Projects for {selected.name}
                    </TableCaption>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Project</TableHead>
                        <TableHead>Service</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead className="text-right">Agreed</TableHead>
                        <TableHead>Payment</TableHead>
                        <TableHead>Placed</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedOrders.map((order) => (
                        <TableRow key={order.id}>
                          <TableCell className="max-w-[16rem] truncate font-medium">
                            {order.title}
                          </TableCell>
                          <TableCell className="text-muted-foreground">
                            {order.service_type}
                          </TableCell>
                          <TableCell>
                            <StatusBadge status={order.status} />
                          </TableCell>
                          <TableCell className="tabular text-right">
                            {formatCurrency(order.amount)}
                          </TableCell>
                          <TableCell>
                            <ToneBadge
                              tone={order.payment_received ? "success" : "neutral"}
                            >
                              {order.payment_received ? "Paid" : "Outstanding"}
                            </ToneBadge>
                          </TableCell>
                          <TableCell className="tabular text-muted-foreground">
                            {formatDate(order.created_at)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardSection>
          </div>
        ) : (
          <div />
        )}
      </div>
    </>
  );
}
