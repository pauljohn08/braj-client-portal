import { useMemo, useState } from "react";
import { FileDown, FileUp, FolderKanban, FolderOpen, Search } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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
import { Pill } from "@/components/app/Badges";
import { StatCard } from "@/components/app/StatCard";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/app/States";
import { useAdminData } from "@/hooks/useAdminData";
import type { OrderFile } from "@/lib/orders";

export default function Documents() {
  const { orders, files, nameFor, loading, error, refresh } = useAdminData();
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const orderById = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );

  const counts = useMemo(() => {
    let input = 0;
    let output = 0;
    const projects = new Set<string>();
    for (const file of files) {
      if (file.file_type === "input") input += 1;
      else output += 1;
      projects.add(file.order_id);
    }
    return { input, output, projects: projects.size };
  }, [files]);

  const groups = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = files.filter((file) => {
      if (typeFilter !== "all" && file.file_type !== typeFilter) return false;
      if (projectFilter !== "all" && file.order_id !== projectFilter) return false;
      if (!q) return true;
      const order = orderById.get(file.order_id);
      return (
        file.file_name.toLowerCase().includes(q) ||
        (order?.title ?? "").toLowerCase().includes(q)
      );
    });

    const byOrder = new Map<string, OrderFile[]>();
    for (const file of filtered) {
      const list = byOrder.get(file.order_id) ?? [];
      list.push(file);
      byOrder.set(file.order_id, list);
    }

    return [...byOrder.entries()]
      .map(([orderId, groupFiles]) => {
        const sorted = [...groupFiles].sort(
          (a, b) =>
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
        );
        return {
          orderId,
          order: orderById.get(orderId),
          files: sorted,
          latest: sorted[0]?.created_at ?? "",
        };
      })
      .sort((a, b) => new Date(b.latest).getTime() - new Date(a.latest).getTime());
  }, [files, query, typeFilter, projectFilter, orderById]);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={refresh} />;

  const hasAny = files.length > 0;

  return (
    <>
      <PageHeader
        title="Documents"
        description="Every file clients have shared and every file we have delivered, grouped by project."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="All documents" value={files.length} />
        <StatCard
          label="Client uploads"
          value={counts.input}
          icon={<FileUp className="h-4 w-4" />}
        />
        <StatCard
          label="Deliverables"
          value={counts.output}
          tone="success"
          icon={<FileDown className="h-4 w-4" />}
        />
        <StatCard
          label="Projects with files"
          value={counts.projects}
          icon={<FolderKanban className="h-4 w-4" />}
        />
      </div>

      {hasAny && (
        <CardSection
          title="Files"
          description="Filter by direction or by project."
          actions={
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search files"
                aria-label="Search files"
                className="w-full pl-9 sm:w-56"
              />
            </div>
          }
        >
          <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={typeFilter} onValueChange={setTypeFilter}>
              <TabsList>
                <TabsTrigger value="all">All documents</TabsTrigger>
                <TabsTrigger value="input">Client uploads</TabsTrigger>
                <TabsTrigger value="output">Deliverables</TabsTrigger>
              </TabsList>
            </Tabs>

            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger className="w-full sm:w-64" aria-label="Filter by project">
                <SelectValue placeholder="All projects" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All projects</SelectItem>
                {orders.map((order) => (
                  <SelectItem key={order.id} value={order.id}>
                    {order.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {groups.length === 0 ? (
            <div className="py-10 text-center">
              <p className="text-sm text-muted-foreground">
                No documents match these filters.
              </p>
              <Button
                variant="outline"
                size="sm"
                className="mt-4"
                onClick={() => {
                  setQuery("");
                  setTypeFilter("all");
                  setProjectFilter("all");
                }}
              >
                Clear filters
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              {groups.map((group) => (
                <div
                  key={group.orderId}
                  className="rounded-lg border border-border"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/70 bg-muted/40 px-4 py-3">
                    <div className="min-w-0">
                      <h3 className="truncate font-display text-sm font-semibold text-foreground">
                        {group.order?.title ?? "Project"}
                      </h3>
                      <p className="truncate text-xs text-muted-foreground">
                        {group.order ? nameFor(group.order.user_id) : "Unknown client"}
                        {group.order ? ` — ${group.order.service_type}` : ""}
                      </p>
                    </div>
                    <Pill>
                      {group.files.length}{" "}
                      {group.files.length === 1 ? "file" : "files"}
                    </Pill>
                  </div>
                  <div className="divide-y divide-border/70 px-4">
                    {group.files.map((file) => (
                      <FileRow
                        key={file.id}
                        file={file}
                        order={group.order}
                        uploaderName={nameFor(file.uploaded_by)}
                      />
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardSection>
      )}

      {!hasAny && (
        <EmptyState
          icon={<FolderOpen className="h-6 w-6" />}
          title="No documents yet"
          description="Client attachments and delivered files appear here as soon as projects start moving."
        />
      )}
    </>
  );
}
