import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FileDown, FileUp, FolderKanban, FolderOpen } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { StatCard } from "@/components/app/StatCard";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/app/States";
import { useClientData } from "@/hooks/useClientData";
import type { OrderFile } from "@/lib/orders";

export default function Documents() {
  const { orders, files, uploaderNames, loading, error, refresh } =
    useClientData();

  const [typeFilter, setTypeFilter] = useState("all");
  const [projectFilter, setProjectFilter] = useState("all");

  const orderById = useMemo(
    () => new Map(orders.map((order) => [order.id, order])),
    [orders],
  );

  const counts = useMemo(() => {
    let input = 0;
    let output = 0;
    const orderIds = new Set<string>();
    for (const file of files) {
      if (file.file_type === "input") input += 1;
      else output += 1;
      orderIds.add(file.order_id);
    }
    return { input, output, projects: orderIds.size };
  }, [files]);

  // Files grouped under the project they belong to, most recently touched first.
  const groups = useMemo(() => {
    const filtered = files.filter((file) => {
      if (typeFilter !== "all" && file.file_type !== typeFilter) return false;
      if (projectFilter !== "all" && file.order_id !== projectFilter) {
        return false;
      }
      return true;
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
      .sort(
        (a, b) => new Date(b.latest).getTime() - new Date(a.latest).getTime(),
      );
  }, [files, typeFilter, projectFilter, orderById]);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={refresh} />;

  const hasAnyFiles = files.length > 0;
  const hasResults = groups.length > 0;

  const clearFilters = () => {
    setTypeFilter("all");
    setProjectFilter("all");
  };

  return (
    <>
      <PageHeader
        title="Documents"
        description="Everything you have shared with BRAJ and everything we have delivered, in one place."
      />

      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <StatCard
            label="Shared by you"
            value={counts.input}
            icon={<FileUp className="h-4 w-4" />}
          />
          <StatCard
            label="Delivered to you"
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

        {hasAnyFiles && (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <Tabs value={typeFilter} onValueChange={setTypeFilter}>
              <TabsList>
                <TabsTrigger value="all">All documents</TabsTrigger>
                <TabsTrigger value="input">Shared by you</TabsTrigger>
                <TabsTrigger value="output">Delivered to you</TabsTrigger>
              </TabsList>
            </Tabs>

            <Select value={projectFilter} onValueChange={setProjectFilter}>
              <SelectTrigger
                className="w-full sm:w-64"
                aria-label="Filter by project"
              >
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
        )}

        {!hasAnyFiles ? (
          <EmptyState
            icon={<FolderOpen className="h-5 w-5" />}
            title="No documents yet"
            description="Files you share and files we deliver collect here, grouped by project, so you always know where to find them."
            action={
              orders.length === 0 ? (
                <Button asChild>
                  <Link to="/order">Submit a request</Link>
                </Button>
              ) : undefined
            }
          />
        ) : !hasResults ? (
          <EmptyState
            icon={<FolderOpen className="h-5 w-5" />}
            title="No documents match these filters"
            description="Nothing in your projects matches the current filters. Clear them to see every document again."
            action={
              <Button variant="outline" onClick={clearFilters}>
                Clear filters
              </Button>
            }
          />
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <CardSection
                key={group.orderId}
                title={group.order?.title ?? "Project"}
                description={group.order?.service_type}
              >
                <div className="divide-y divide-border/70">
                  {group.files.map((file) => (
                    <FileRow
                      key={file.id}
                      file={file}
                      order={group.order}
                      uploaderName={uploaderNames.get(file.uploaded_by ?? "")}
                    />
                  ))}
                </div>
              </CardSection>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
