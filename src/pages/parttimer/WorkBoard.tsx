import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FolderKanban, PlayCircle, Search, Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSection } from "@/components/app/CardSection";
import { FileRow } from "@/components/app/FileRow";
import { MilestoneRail } from "@/components/app/MilestoneRail";
import { PageHeader } from "@/components/app/PageHeader";
import { Progress } from "@/components/ui/progress";
import { ServiceGlyph } from "@/components/app/ServiceGlyph";
import { StatCard } from "@/components/app/StatCard";
import { StatusBadge, ToneBadge } from "@/components/app/Badges";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/app/States";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  displayName,
  formatCurrency,
  formatDate,
  getMilestones,
  getProgressPercent,
  progressSummary,
  relativeTime,
  type Order,
  type OrderFile,
  type Profile,
} from "@/lib/orders";

const TABS = [
  { value: "available", label: "Available" },
  { value: "mine", label: "My work" },
  { value: "delivered", label: "Delivered" },
  { value: "all", label: "Everything" },
];

export default function WorkBoard() {
  const { user } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [files, setFiles] = useState<OrderFile[]>([]);
  const [profiles, setProfiles] = useState<Map<string, Profile>>(new Map());
  const [allowedServices, setAllowedServices] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [tab, setTab] = useState("available");
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const [ordersResult, allowedResult] = await Promise.all([
        supabase
          .from("orders")
          .select("*")
          .or(`assigned_to.is.null,assigned_to.eq.${user.id}`)
          .order("created_at", { ascending: false }),
        supabase
          .from("parttimer_allowed_services")
          .select("service_type")
          .eq("parttimer_id", user.id),
      ]);

      if (ordersResult.error) throw ordersResult.error;

      const orderList = (ordersResult.data ?? []) as Order[];
      setOrders(orderList);
      setAllowedServices(
        (allowedResult.data ?? []).map((row) => row.service_type),
      );

      const orderIds = orderList.map((order) => order.id);
      if (orderIds.length === 0) {
        setFiles([]);
        return;
      }

      const { data: fileRows, error: filesError } = await supabase
        .from("order_files")
        .select("*")
        .in("order_id", orderIds);
      if (filesError) throw filesError;

      const fileList = (fileRows ?? []) as OrderFile[];
      setFiles(fileList);

      const userIds = Array.from(
        new Set([
          ...orderList.map((order) => order.user_id),
          ...fileList
            .map((file) => file.uploaded_by)
            .filter((id): id is string => Boolean(id)),
        ]),
      );

      const { data: profileRows } = await supabase
        .from("profiles")
        .select("*")
        .in("user_id", userIds);

      setProfiles(
        new Map(((profileRows ?? []) as Profile[]).map((row) => [row.user_id, row])),
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "We could not load the work board.",
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  const nameFor = useCallback(
    (id: string | null | undefined) =>
      displayName(id ? profiles.get(id) : undefined, "Unknown"),
    [profiles],
  );

  const outputCounts = useMemo(() => {
    const counts = new Map<string, number>();
    for (const file of files) {
      if (file.file_type !== "output") continue;
      counts.set(file.order_id, (counts.get(file.order_id) ?? 0) + 1);
    }
    return counts;
  }, [files]);

  /**
   * The board holds work nobody has taken yet plus the part-timer's own — a
   * project someone else claimed is not theirs to look at, let alone download
   * from. Paid work drops off once there is nothing left to do on it. The query
   * above already excludes other people's claimed work; this only hides the
   * finished-and-paid end of the list.
   */
  const visible = useMemo(
    () =>
      orders.filter(
        (order) => !(order.status === "completed" && order.payment_received),
      ),
    [orders],
  );

  const canWorkOn = useCallback(
    (serviceType: string) =>
      allowedServices.length === 0 || allowedServices.includes(serviceType),
    [allowedServices],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return visible.filter((order) => {
      if (tab === "available" && (order.status !== "pending" || order.assigned_to !== null))
        return false;
      if (tab === "mine" && order.assigned_to !== user?.id) return false;
      if (tab === "delivered" && order.status !== "completed") return false;
      if (!q) return true;
      return (
        order.title.toLowerCase().includes(q) ||
        order.service_type.toLowerCase().includes(q) ||
        nameFor(order.user_id).toLowerCase().includes(q)
      );
    });
  }, [visible, tab, query, user?.id, nameFor]);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={() => void load()} />;

  const selected =
    visible.find((order) => order.id === selectedId) ?? filtered[0] ?? null;
  const selectedFiles = selected
    ? files.filter((file) => file.order_id === selected.id)
    : [];
  const selectedOutputs = selectedFiles.filter(
    (file) => file.file_type === "output",
  );

  const claim = async (order: Order) => {
    if (!user) return;
    if (!canWorkOn(order.service_type)) {
      toast({
        title: "Not your service",
        description:
          "Ask the admin to enable this service type for you before claiming it.",
        variant: "destructive",
      });
      return;
    }

    setBusy(true);
    const { error: claimError } = await supabase
      .from("orders")
      .update({ status: "in_progress", assigned_to: user.id })
      .eq("id", order.id)
      .is("assigned_to", null);
    setBusy(false);

    if (claimError) {
      toast({
        title: "Could not claim this project",
        description: claimError.message,
        variant: "destructive",
      });
      return;
    }

    toast({
      title: "Project claimed",
      description: "It is yours now. Upload the finished files when you are done.",
    });
    void load();
  };

  const uploadOutputs = async (order: Order, chosen: File[]) => {
    if (!user) return;
    setUploading(true);

    let succeeded = 0;
    let failed = 0;

    for (const file of chosen) {
      const path = `${order.user_id}/${order.id}/${file.name}`;
      const { error: uploadError } = await supabase.storage
        .from("output-files")
        .upload(path, file, { upsert: true });

      if (uploadError) {
        failed += 1;
        toast({
          title: `Could not upload ${file.name}`,
          description: uploadError.message,
          variant: "destructive",
        });
        continue;
      }

      const { error: rowError } = await supabase.from("order_files").insert({
        order_id: order.id,
        file_type: "output",
        file_path: path,
        file_name: file.name,
        uploaded_by: user.id,
      });

      if (rowError) {
        failed += 1;
        toast({
          title: `Could not save ${file.name}`,
          description: rowError.message,
          variant: "destructive",
        });
        continue;
      }

      succeeded += 1;
    }

    if (succeeded > 0) {
      if (order.status === "in_progress") {
        const { error: statusError } = await supabase
          .from("orders")
          .update({ status: "completed" })
          .eq("id", order.id);

        if (statusError) {
          toast({
            title: "Files uploaded, but the status did not change",
            description: statusError.message,
            variant: "destructive",
          });
        } else {
          toast({
            title:
              succeeded === 1 ? "File delivered" : `${succeeded} files delivered`,
            description:
              failed > 0
                ? `${failed} of them did not upload.`
                : "The client can download them once we confirm payment.",
          });
        }
      } else {
        toast({
          title: succeeded === 1 ? "File added" : `${succeeded} files added`,
          description:
            failed > 0 ? `${failed} of them did not upload.` : undefined,
        });
      }
    }

    setUploading(false);
    void load();
  };

  return (
    <>
      <PageHeader
        title="Work board"
        description="Claim a project, do the work, and upload the finished files."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Available to claim"
          value={
            visible.filter(
              (order) => order.status === "pending" && order.assigned_to === null,
            ).length
          }
        />
        <StatCard
          label="Your active work"
          value={
            visible.filter(
              (order) =>
                order.assigned_to === user?.id && order.status === "in_progress",
            ).length
          }
          tone="progress"
        />
        <StatCard
          label="Delivered by you"
          value={
            orders.filter(
              (order) =>
                order.assigned_to === user?.id && order.status === "completed",
            ).length
          }
          tone="success"
        />
        <StatCard
          label="On offer to you"
          value={
            allowedServices.length === 0
              ? "Every service"
              : `${allowedServices.length} ${
                  allowedServices.length === 1 ? "service" : "services"
                }`
          }
        />
      </div>

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
                placeholder="Search by title or client"
                aria-label="Search the work board"
                className="w-full pl-9 sm:w-64"
              />
            </div>
          </div>

          {visible.length === 0 ? (
            <EmptyState
              icon={<FolderKanban className="h-6 w-6" />}
              title="Nothing on the board"
              description="When a client request has been priced and is ready to start, it appears here for you to claim."
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
                const isMine = order.assigned_to === user?.id;
                const percent = getProgressPercent(
                  order,
                  outputCounts.get(order.id) ?? 0,
                );

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
                            {order.service_type} — {nameFor(order.user_id)}
                          </p>
                          <div className="mt-2 flex flex-wrap items-center gap-2">
                            <ToneBadge tone="neutral" dot={false} className="tabular">
                              {formatCurrency(order.amount)}
                            </ToneBadge>
                            {isMine && <ToneBadge tone="info">Your project</ToneBadge>}
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

            <CardSection title="The brief">
              <dl className="space-y-3 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Client</dt>
                  <dd className="text-right font-medium text-foreground">
                    {nameFor(selected.user_id)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Deadline</dt>
                  <dd className="text-right font-medium text-foreground">
                    {formatDate(selected.deadline)}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Posted</dt>
                  <dd className="text-right font-medium text-foreground">
                    {relativeTime(selected.created_at)}
                  </dd>
                </div>
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
                      {selected.word_count}
                    </dd>
                  </div>
                ) : null}
              </dl>

              {selected.instructions ? (
                <div className="mt-5 border-t border-border/70 pt-5">
                  <h3 className="text-sm font-medium text-foreground">
                    What the client asked for
                  </h3>
                  <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-muted-foreground">
                    {selected.instructions}
                  </p>
                </div>
              ) : null}
            </CardSection>

            <CardSection
              title="Your next step"
              description="Claiming a project assigns it to you alone."
            >
              <div className="space-y-3">
                {selected.status === "pending" && selected.assigned_to === null && (
                  <>
                    <Button
                      className="w-full"
                      disabled={busy || !canWorkOn(selected.service_type)}
                      onClick={() => void claim(selected)}
                    >
                      <PlayCircle className="h-4 w-4" />
                      Claim this project
                    </Button>
                    {!canWorkOn(selected.service_type) && (
                      <p className="text-xs leading-relaxed text-warning">
                        This service is not enabled for you. Ask the admin to turn
                        it on if you should be able to take it.
                      </p>
                    )}
                  </>
                )}

                {selected.assigned_to === user?.id &&
                  (selected.status === "in_progress" ||
                    (selected.status === "completed" &&
                      !selected.payment_received)) && (
                    <>
                      <Button
                        className="w-full"
                        disabled={uploading}
                        onClick={() => fileInput.current?.click()}
                      >
                        <Upload className="h-4 w-4" />
                        {uploading ? "Uploading…" : "Upload finished files"}
                      </Button>
                      <input
                        ref={fileInput}
                        type="file"
                        multiple
                        className="hidden"
                        aria-label="Finished files"
                        onChange={(event) => {
                          // Copy the files out before clearing the input — clearing
                          // it empties the live FileList, leaving nothing to upload.
                          const chosen = Array.from(event.target.files ?? []);
                          event.target.value = "";
                          if (chosen.length > 0) {
                            void uploadOutputs(selected, chosen);
                          }
                        }}
                      />
                      <p className="text-xs leading-relaxed text-muted-foreground">
                        You can pick more than one file. The first delivery marks
                        the project as completed and tells the client it is ready.
                      </p>
                    </>
                  )}

                {selected.payment_received && (
                  <p className="text-sm leading-relaxed text-muted-foreground">
                    The client has paid, so this project is finished.
                  </p>
                )}
              </div>
            </CardSection>

            <CardSection
              title="Files"
              description={
                selectedOutputs.length > 0
                  ? `${selectedOutputs.length} delivered so far.`
                  : "Client attachments and anything you have delivered."
              }
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
