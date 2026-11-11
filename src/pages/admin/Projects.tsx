import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FileDown, FolderKanban, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSection } from "@/components/app/CardSection";
import { FileRow } from "@/components/app/FileRow";
import { MilestoneRail } from "@/components/app/MilestoneRail";
import { PageHeader } from "@/components/app/PageHeader";
import { Progress } from "@/components/ui/progress";
import { ServiceGlyph } from "@/components/app/ServiceGlyph";
import { StatusBadge, ToneBadge } from "@/components/app/Badges";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/app/States";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAdminData } from "@/hooks/useAdminData";
import { downloadReceipt } from "@/lib/download";
import { getAmountFromService, SHARING_PER_SERVICE } from "@/lib/services";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  getMilestones,
  getProgressPercent,
  progressSummary,
  quoteIsSet,
  relativeTime,
  type Order,
  type OrderStatus,
} from "@/lib/orders";

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: "pending", label: "Awaiting review" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

const TABS = [
  { value: "all", label: "All projects" },
  { value: "unassigned", label: "Unassigned" },
  { value: "in_progress", label: "In progress" },
  { value: "delivered", label: "Delivered" },
];

export default function Projects() {
  const [searchParams] = useSearchParams();
  const {
    orders,
    files,
    receipts,
    ratings,
    nameFor,
    loading,
    error,
    refresh,
    setOrderLocally,
    addTransactionLocally,
  } = useAdminData();

  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get("order"),
  );
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [busy, setBusy] = useState(false);

  const engaged = useMemo(
    () => orders.filter((order) => order.status !== "pending"),
    [orders],
  );

  const outputCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of files) {
      if (file.file_type !== "output") continue;
      counts.set(file.order_id, (counts.get(file.order_id) ?? 0) + 1);
    }
    return counts;
  }, [files]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return engaged.filter((order) => {
      if (tab === "unassigned" && order.assigned_to !== null) return false;
      if (tab === "in_progress" && order.status !== "in_progress") return false;
      if (tab === "delivered" && order.status !== "completed") return false;
      if (!q) return true;
      return (
        order.title.toLowerCase().includes(q) ||
        order.service_type.toLowerCase().includes(q) ||
        nameFor(order.user_id).toLowerCase().includes(q) ||
        nameFor(order.assigned_to).toLowerCase().includes(q)
      );
    });
  }, [engaged, tab, query, nameFor]);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={refresh} />;

  const selected =
    engaged.find((order) => order.id === selectedId) ?? filtered[0] ?? null;

  const selectedFiles = selected
    ? files.filter((file) => file.order_id === selected.id)
    : [];
  const selectedReceipt = selected
    ? receipts.find((receipt) => receipt.order_id === selected.id)
    : undefined;

  const amountFor = (order: Order) =>
    Number(order.amount) ||
    getAmountFromService(order.service_type, order.pricing_tier);

  const sharingFor = (order: Order) =>
    SHARING_PER_SERVICE[order.service_type] ?? {
      ownerPct: 40,
      parttimerPct: 60,
    };

  const pricingBlocked = (order: Order) =>
    (order.service_type === "Statistical Analysis" &&
      order.pricing_tier === "To be set by admin") ||
    (order.service_type === "Research" && !quoteIsSet(order));

  const changeStatus = async (status: OrderStatus) => {
    if (!selected) return;
    setBusy(true);
    const { error: updateError } = await supabase
      .from("orders")
      .update({ status })
      .eq("id", selected.id);
    setBusy(false);

    if (updateError) {
      toast({
        title: "Could not change the status",
        description: updateError.message,
        variant: "destructive",
      });
      return;
    }

    setOrderLocally(selected.id, { status });
    toast({ title: "Status updated" });
  };

  /**
   * Confirming payment is the one action that also writes a transaction: the
   * owner/part-timer split for the service is recorded at that moment, using the
   * order's agreed amount. Un-confirming only flips the flag back.
   */
  const setPayment = async (next: boolean) => {
    if (!selected) return;

    if (pricingBlocked(selected)) {
      toast({
        title: "Price this project first",
        description:
          "Confirm the pricing tier or agreed amount before recording payment.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);

    if (next) {
      const amount = amountFor(selected);
      const sharing = sharingFor(selected);
      const adminAmount =
        Math.round(amount * (sharing.ownerPct / 100) * 100) / 100;
      const parttimerAmount =
        Math.round(amount * (sharing.parttimerPct / 100) * 100) / 100;

      const { data, error: txError } = await supabase
        .from("transactions")
        .insert({
          order_id: selected.id,
          amount,
          admin_amount: adminAmount,
          parttimer_amount: parttimerAmount,
          assigned_to: selected.assigned_to ?? null,
        })
        .select()
        .single();

      if (txError) {
        setBusy(false);
        toast({
          title: "Could not record the transaction",
          description: txError.message,
          variant: "destructive",
        });
        return;
      }

      const { error: updateError } = await supabase
        .from("orders")
        .update({ payment_received: true })
        .eq("id", selected.id);

      setBusy(false);

      if (updateError) {
        toast({
          title: "Could not confirm payment",
          description: updateError.message,
          variant: "destructive",
        });
        return;
      }

      setOrderLocally(selected.id, { payment_received: true });
      addTransactionLocally(data);
      toast({
        title: "Payment confirmed",
        description:
          "The client can download their files, and the split has been recorded.",
      });
      return;
    }

    const { error: updateError } = await supabase
      .from("orders")
      .update({ payment_received: false })
      .eq("id", selected.id);

    setBusy(false);

    if (updateError) {
      toast({
        title: "Could not update payment",
        description: updateError.message,
        variant: "destructive",
      });
      return;
    }

    setOrderLocally(selected.id, { payment_received: false });
    toast({ title: "Payment confirmation withdrawn" });
  };

  const split = selected ? sharingFor(selected) : null;
  const amount = selected ? amountFor(selected) : 0;

  return (
    <>
      <PageHeader
        title="Projects"
        description="Work in progress and delivered projects, with the controls that move each one forward."
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={tab} onValueChange={setTab}>
              <TabsList>
                {TABS.map((item) => (
                  <TabsTrigger key={item.value} value={item.value}>
                    {item.label}
                  </TabsTrigger>
                ))}
              </TabsList>
            </Tabs>

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
                className="w-full pl-9 sm:w-56"
              />
            </div>
          </div>

          {engaged.length === 0 ? (
            <EmptyState
              icon={<FolderKanban className="h-6 w-6" />}
              title="No projects yet"
              description="Once you price a request and a consultant picks it up, the project appears here with its status and payment controls."
            />
          ) : filtered.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                Nothing matches this view.
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
          ) : (
            <ul className="space-y-3">
              {filtered.map((order) => {
                const isSelected = selected?.id === order.id;
                const percent = getProgressPercent(
                  order,
                  outputCounts.get(order.id) ?? 0,
                );
                const rating = order.assigned_to
                  ? ratings.get(order.assigned_to)
                  : undefined;

                return (
                  <li key={order.id}>
                    <button
                      type="button"
                      onClick={() => setSelectedId(order.id)}
                      aria-current={isSelected ? "true" : undefined}
                      className={cn(
                        "w-full rounded-lg border bg-card p-4 text-left transition-colors hover:bg-muted/40",
                        isSelected
                          ? "border-primary/40 ring-1 ring-primary/20"
                          : "border-border",
                      )}
                    >
                      <div className="flex items-start gap-3">
                        <span
                          aria-hidden
                          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"
                        >
                          <ServiceGlyph
                            serviceName={order.service_type}
                            className="h-4 w-4"
                          />
                        </span>

                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <p className="truncate text-sm font-semibold text-foreground">
                              {order.title}
                            </p>
                            <StatusBadge status={order.status} />
                          </div>
                          <p className="mt-0.5 truncate text-sm text-muted-foreground">
                            {nameFor(order.user_id)} —{" "}
                            {order.assigned_to
                              ? nameFor(order.assigned_to)
                              : "Not yet assigned"}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <ToneBadge tone="neutral" dot={false} className="tabular">
                              {formatCurrency(amountFor(order))}
                            </ToneBadge>
                            {rating && (
                              <ToneBadge tone="warning" dot={false}>
                                {rating.avg.toFixed(1)} / 5 ({rating.count})
                              </ToneBadge>
                            )}
                          </div>
                          <div className="mt-3 space-y-1.5">
                            <div className="flex items-baseline justify-between gap-3 text-xs">
                              <span className="font-medium text-foreground">
                                {progressSummary(
                                  order,
                                  outputCounts.get(order.id) ?? 0,
                                )}
                              </span>
                              <span className="tabular text-muted-foreground">
                                {percent}%
                              </span>
                            </div>
                            <Progress value={percent} className="h-1.5" />
                          </div>
                        </div>
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        {selected ? (
          <div className="space-y-6">
            <CardSection
              title={selected.title}
              description={`${selected.service_type} — ${selected.pricing_tier}`}
              actions={<StatusBadge status={selected.status} />}
            >
              <MilestoneRail
                milestones={getMilestones(
                  selected,
                  outputCounts.get(selected.id) ?? 0,
                )}
              />
            </CardSection>

            <CardSection
              title="Status"
              description="Changing this is visible to the client immediately."
            >
              <Select
                value={selected.status}
                onValueChange={(value) =>
                  void changeStatus(value as OrderStatus)
                }
                disabled={busy}
              >
                <SelectTrigger aria-label="Project status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <dl className="mt-5 space-y-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Client</dt>
                  <dd className="text-right font-medium text-foreground">
                    {nameFor(selected.user_id)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Consultant</dt>
                  <dd className="text-right font-medium text-foreground">
                    {selected.assigned_to
                      ? nameFor(selected.assigned_to)
                      : "Not yet assigned"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Last movement</dt>
                  <dd className="text-right font-medium text-foreground">
                    {relativeTime(selected.updated_at)}
                  </dd>
                </div>
              </dl>
            </CardSection>

            <CardSection
              title="Payment"
              description="Confirming records the owner and part-timer split for this service."
            >
              <div className="space-y-4">
                <div className="rounded-lg border border-border bg-muted/40 p-4">
                  <dl className="space-y-2 text-sm">
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">Total</dt>
                      <dd className="tabular font-medium text-foreground">
                        {formatCurrency(amount)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">
                        Owner ({split?.ownerPct}%)
                      </dt>
                      <dd className="tabular font-medium text-foreground">
                        {formatCurrency(
                          Math.round(amount * ((split?.ownerPct ?? 40) / 100) * 100) /
                            100,
                        )}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between gap-3">
                      <dt className="text-muted-foreground">
                        Part-timer ({split?.parttimerPct}%)
                      </dt>
                      <dd className="tabular font-medium text-foreground">
                        {formatCurrency(
                          Math.round(
                            amount * ((split?.parttimerPct ?? 60) / 100) * 100,
                          ) / 100,
                        )}
                      </dd>
                    </div>
                  </dl>
                </div>

                {selectedReceipt && !selected.payment_received && (
                  <Button
                    variant="outline"
                    className="w-full"
                    onClick={() =>
                      void downloadReceipt(
                        selectedReceipt.file_path,
                        selectedReceipt.file_name,
                      )
                    }
                  >
                    <FileDown className="h-4 w-4" />
                    View client receipt
                  </Button>
                )}

                <div className="flex items-start gap-3 rounded-lg border border-border p-4">
                  <Checkbox
                    id="payment-received"
                    checked={selected.payment_received}
                    disabled={busy}
                    onCheckedChange={(checked) => void setPayment(checked === true)}
                  />
                  <div className="space-y-1">
                    <Label htmlFor="payment-received" className="cursor-pointer">
                      Payment received
                    </Label>
                    <p className="text-xs leading-relaxed text-muted-foreground">
                      {pricingBlocked(selected)
                        ? "This project needs a confirmed price before payment can be recorded."
                        : "Releasing this unlocks the client's delivered files."}
                    </p>
                  </div>
                </div>
              </div>
            </CardSection>

            <CardSection
              title="Files"
              description="Everything on this project, in both directions."
            >
              {selectedFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No files on this project yet.
                </p>
              ) : (
                <div className="divide-y divide-border/70">
                  {selectedFiles.map((file) => (
                    <FileRow
                      key={file.id}
                      file={file}
                      order={selected}
                      uploaderName={nameFor(file.uploaded_by)}
                    />
                  ))}
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
