import { useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Inbox, Search } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
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
import { PageHeader } from "@/components/app/PageHeader";
import { ServiceGlyph } from "@/components/app/ServiceGlyph";
import { StatusBadge, ToneBadge } from "@/components/app/Badges";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/app/States";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAdminData } from "@/hooks/useAdminData";
import { SERVICES } from "@/lib/services";
import { cn } from "@/lib/utils";
import {
  formatCurrency,
  formatDate,
  quoteIsSet,
  relativeTime,
  statusHint,
} from "@/lib/orders";

const TABS = [
  { value: "awaiting", label: "Awaiting a price" },
  { value: "priced", label: "Priced" },
  { value: "all", label: "All requests" },
];

export default function Requests() {
  const [searchParams] = useSearchParams();
  const {
    orders,
    files,
    nameFor,
    loading,
    error,
    refresh,
    setOrderLocally,
  } = useAdminData();

  const [selectedId, setSelectedId] = useState<string | null>(
    searchParams.get("order"),
  );
  const [tab, setTab] = useState("awaiting");
  const [query, setQuery] = useState("");
  const [researchAmount, setResearchAmount] = useState("");
  const [saving, setSaving] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const pending = useMemo(
    () => orders.filter((order) => order.status === "pending"),
    [orders],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return pending.filter((order) => {
      if (tab === "awaiting" && quoteIsSet(order)) return false;
      if (tab === "priced" && !quoteIsSet(order)) return false;
      if (!q) return true;
      return (
        order.title.toLowerCase().includes(q) ||
        order.service_type.toLowerCase().includes(q) ||
        nameFor(order.user_id).toLowerCase().includes(q)
      );
    });
  }, [pending, tab, query, nameFor]);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={refresh} />;

  const selected =
    pending.find((order) => order.id === selectedId) ?? filtered[0] ?? null;
  const selectedFiles = selected
    ? files.filter((file) => file.order_id === selected.id)
    : [];

  const statisticalTiers =
    SERVICES.find((service) => service.name === "Statistical Analysis")?.tiers ??
    [];

  const needsStatisticalTier =
    selected?.service_type === "Statistical Analysis" &&
    selected.pricing_tier === "To be set by admin";

  const needsResearchAmount =
    selected?.service_type === "Research" &&
    (Number(selected.amount) === 0 ||
      selected.pricing_tier === "To be set by admin" ||
      selected.pricing_tier === "Open Quotation");

  const setStatisticalTier = async (tierName: string) => {
    if (!selected) return;
    const tier = statisticalTiers.find((item) => item.name === tierName);
    if (!tier) return;

    setSaving(true);
    const { error: updateError } = await supabase
      .from("orders")
      .update({ pricing_tier: tier.name, amount: tier.priceValue })
      .eq("id", selected.id);
    setSaving(false);

    if (updateError) {
      toast({
        title: "Could not set the pricing tier",
        description: updateError.message,
        variant: "destructive",
      });
      return;
    }

    setOrderLocally(selected.id, {
      pricing_tier: tier.name,
      amount: tier.priceValue,
    });
    toast({
      title: "Pricing tier set",
      description: `${tier.name} — ${formatCurrency(tier.priceValue)}`,
    });
  };

  const submitResearchAmount = async () => {
    if (!selected) return;
    const amount = Number(researchAmount);

    if (!Number.isFinite(amount) || amount < 0) {
      toast({ title: "Enter a valid amount", variant: "destructive" });
      return;
    }

    setSaving(true);
    const { error: updateError } = await supabase
      .from("orders")
      .update({ pricing_tier: "Agreed amount", amount })
      .eq("id", selected.id);
    setSaving(false);

    if (updateError) {
      toast({
        title: "Could not set the amount",
        description: updateError.message,
        variant: "destructive",
      });
      return;
    }

    setOrderLocally(selected.id, {
      pricing_tier: "Agreed amount",
      amount,
    });
    setResearchAmount("");
    toast({
      title: "Research amount set",
      description: formatCurrency(amount),
    });
  };

  const deleteRequest = async () => {
    if (!selected) return;
    setSaving(true);
    const { error: deleteError } = await supabase
      .from("orders")
      .delete()
      .eq("id", selected.id)
      .eq("user_id", selected.user_id);
    setSaving(false);
    setConfirmDelete(false);

    if (deleteError) {
      toast({
        title: "Could not delete the request",
        description: deleteError.message,
        variant: "destructive",
      });
      return;
    }

    setSelectedId(null);
    await refresh();
    toast({ title: "Request deleted" });
  };

  return (
    <>
      <PageHeader
        title="Service requests"
        description="Review what clients have asked for, agree the price, and release the work."
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
                placeholder="Search requests"
                aria-label="Search requests"
                className="w-full pl-9 sm:w-56"
              />
            </div>
          </div>

          {pending.length === 0 ? (
            <EmptyState
              icon={<Inbox className="h-6 w-6" />}
              title="No requests waiting"
              description="Every request has been quoted and released. New ones appear here the moment a client submits them."
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
                            {order.service_type} — {order.pricing_tier}
                          </p>
                          <p className="mt-0.5 truncate text-xs text-muted-foreground">
                            {nameFor(order.user_id)} — sent{" "}
                            {relativeTime(order.created_at)}
                          </p>
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
              <dl className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Client</dt>
                  <dd className="text-right font-medium text-foreground">
                    {nameFor(selected.user_id)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Submitted</dt>
                  <dd className="tabular text-right font-medium text-foreground">
                    {formatDate(selected.created_at)}
                  </dd>
                </div>
                {selected.deadline && (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Deadline</dt>
                    <dd className="tabular text-right font-medium text-foreground">
                      {formatDate(selected.deadline)}
                    </dd>
                  </div>
                )}
                {selected.chapter_count ? (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Chapters</dt>
                    <dd className="tabular text-right font-medium text-foreground">
                      {selected.chapter_count}
                    </dd>
                  </div>
                ) : null}
                {selected.word_count ? (
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Word count</dt>
                    <dd className="tabular text-right font-medium text-foreground">
                      {selected.word_count.toLocaleString("en-PH")}
                    </dd>
                  </div>
                ) : null}
              </dl>

              <p className="mt-4 border-t border-border/70 pt-4 text-sm leading-relaxed text-muted-foreground">
                {statusHint(selected)}
              </p>
            </CardSection>

            <CardSection
              title="Price"
              description="Until an amount is agreed, the request cannot be picked up."
            >
              {quoteIsSet(selected) && !needsResearchAmount ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-sm text-muted-foreground">Agreed amount</p>
                    <p className="tabular mt-1 font-display text-2xl font-semibold text-foreground">
                      {formatCurrency(selected.amount)}
                    </p>
                  </div>
                  <ToneBadge tone="success">Priced as {selected.pricing_tier}</ToneBadge>
                </div>
              ) : needsStatisticalTier ? (
                <div className="space-y-2">
                  <Label htmlFor="tier">Pricing tier</Label>
                  <Select
                    value=""
                    onValueChange={(value) => void setStatisticalTier(value)}
                    disabled={saving}
                  >
                    <SelectTrigger id="tier">
                      <SelectValue placeholder="Choose a tier" />
                    </SelectTrigger>
                    <SelectContent>
                      {statisticalTiers.map((tier) => (
                        <SelectItem key={tier.name} value={tier.name}>
                          {tier.name} — {tier.price}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    The client has already agreed to pay for this service.
                  </p>
                </div>
              ) : needsResearchAmount ? (
                <div className="space-y-2">
                  <Label htmlFor="research-amount">Agreed amount (₱)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="research-amount"
                      type="number"
                      min={0}
                      step="0.01"
                      value={researchAmount}
                      onChange={(event) =>
                        setResearchAmount(event.target.value)
                      }
                      placeholder="0"
                      inputMode="decimal"
                    />
                    <Button
                      onClick={() => void submitResearchAmount()}
                      disabled={saving || !researchAmount}
                    >
                      Set amount
                    </Button>
                  </div>
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Research is quoted case by case. Enter what you agreed with
                    the client.
                  </p>
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  This service has a fixed price of{" "}
                  <span className="tabular font-medium text-foreground">
                    {formatCurrency(selected.amount)}
                  </span>
                  .
                </p>
              )}
            </CardSection>

            <CardSection
              title="Attachments"
              description="Files the client sent with the request."
            >
              {selectedFiles.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No files were attached.
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

            <CardSection title="Danger zone">
              <p className="text-sm leading-relaxed text-muted-foreground">
                Deleting removes the request and its attachments permanently.
                Only requests still awaiting review can be deleted.
              </p>
              <Button
                variant="outline"
                className="mt-4 text-destructive hover:bg-destructive-muted hover:text-destructive"
                disabled={saving}
                onClick={() => setConfirmDelete(true)}
              >
                Delete request
              </Button>
            </CardSection>
          </div>
        ) : (
          <div />
        )}
      </div>

      <AlertDialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this request?</AlertDialogTitle>
            <AlertDialogDescription>
              {selected
                ? `"${selected.title}" from ${nameFor(selected.user_id)} will be removed for good, along with every file attached to it.`
                : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={saving}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={saving}
              onClick={(event) => {
                event.preventDefault();
                void deleteRequest();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {saving ? "Deleting…" : "Delete request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
