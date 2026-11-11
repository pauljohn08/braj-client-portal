import { Link } from "react-router-dom";
import {
  CheckCircle2,
  FileText,
  FolderKanban,
  Plus,
  ReceiptText,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { ActivityList } from "@/components/app/ActivityList";
import { CardSection } from "@/components/app/CardSection";
import { FileRow } from "@/components/app/FileRow";
import { MilestoneRail } from "@/components/app/MilestoneRail";
import { PageHeader } from "@/components/app/PageHeader";
import { ProjectCard } from "@/components/app/ProjectCard";
import { StatCard } from "@/components/app/StatCard";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/app/States";
import { StatusBadge, ToneBadge } from "@/components/app/Badges";
import { useAuth } from "@/hooks/useAuth";
import { useClientData } from "@/hooks/useClientData";
import {
  displayName,
  formatCurrency,
  getDeadlineInfo,
  getMilestones,
  quoteIsSet,
} from "@/lib/orders";

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return "Good morning";
  if (hour < 18) return "Good afternoon";
  return "Good evening";
}

/**
 * The client's landing page: what is happening, what is waiting on them, and
 * one obvious way to start something new.
 */
export default function Overview() {
  const { user } = useAuth();
  const {
    orders,
    files,
    profile,
    uploaderNames,
    outputCounts,
    activity,
    actions,
    loading,
    error,
    refresh,
  } = useClientData();

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={refresh} />;

  const firstName = displayName(profile, user?.email ?? "there").split(/\s+/)[0];

  const active = orders.filter(
    (order) => !(order.status === "completed" && order.payment_received),
  );
  const settled = orders.filter(
    (order) => order.status === "completed" && order.payment_received,
  );
  const outstanding = orders
    .filter(
      (order) =>
        order.status === "completed" &&
        !order.payment_received &&
        quoteIsSet(order),
    )
    .reduce((sum, order) => sum + Number(order.amount ?? 0), 0);
  const outputTotal = files.filter((file) => file.file_type === "output").length;

  const primary = active[0];
  const others = active.slice(1);
  const primaryDeadline = primary ? getDeadlineInfo(primary) : null;

  const orderById = new Map(orders.map((order) => [order.id, order]));
  const recentFiles = [...files]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 5);

  return (
    <>
      <PageHeader
        title={`${greeting()}, ${firstName}`}
        description={
          orders.length === 0
            ? "Submit your first request and its progress will appear here."
            : "Here is where your projects stand, and anything we need from you."
        }
        actions={
          <Button asChild>
            <Link to="/order">
              <Plus className="h-4 w-4" />
              Submit a request
            </Link>
          </Button>
        }
      />

      {actions.length > 0 && (
        <CardSection
          className="mb-6"
          title="What we need from you"
          description="Everything currently waiting on you, and nothing else."
        >
          <ul className="divide-y divide-border/70">
            {actions.map((action) => (
              <li
                key={`${action.kind}-${action.orderId}`}
                className="flex flex-wrap items-start justify-between gap-3 py-3 first:pt-0 last:pb-0"
              >
                <div className="min-w-0">
                  <ToneBadge tone={action.tone}>{action.label}</ToneBadge>
                  <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">
                    {action.detail}
                  </p>
                  <p className="mt-0.5 truncate text-xs text-muted-foreground">
                    {action.orderTitle}
                  </p>
                </div>
                <Button variant="outline" size="sm" asChild className="shrink-0">
                  <Link to={`/dashboard/projects/${action.orderId}`}>
                    {action.kind === "pay" ? "Pay and download" : "Open project"}
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </CardSection>
      )}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Active projects"
          value={active.length}
          icon={<FolderKanban className="h-4 w-4" />}
          tone="progress"
          hint="Still in review or in progress."
        />
        <StatCard
          label="Awaiting payment"
          value={formatCurrency(outstanding)}
          icon={<ReceiptText className="h-4 w-4" />}
          tone={outstanding > 0 ? "warning" : "neutral"}
          hint="Delivered work that is not settled yet."
        />
        <StatCard
          label="Documents delivered"
          value={outputTotal}
          icon={<FileText className="h-4 w-4" />}
          tone="success"
          hint="Finished files available to you."
        />
        <StatCard
          label="Completed projects"
          value={settled.length}
          icon={<CheckCircle2 className="h-4 w-4" />}
          hint="Delivered and settled."
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {primary ? (
            <CardSection
              title={primary.title}
              description={`${primary.service_type} — ${primary.pricing_tier}`}
              actions={<StatusBadge status={primary.status} />}
            >
              <div className="space-y-5">
                <div className="flex flex-wrap items-center gap-2">
                  {quoteIsSet(primary) ? (
                    <ToneBadge tone="neutral" dot={false} className="tabular">
                      {formatCurrency(primary.amount)}
                    </ToneBadge>
                  ) : (
                    <ToneBadge tone="warning" dot={false}>
                      Price to be confirmed
                    </ToneBadge>
                  )}
                  {primaryDeadline && (
                    <ToneBadge
                      tone={primaryDeadline.tone}
                      dot={false}
                      className="tabular"
                    >
                      {primaryDeadline.label}
                    </ToneBadge>
                  )}
                </div>

                <MilestoneRail
                  milestones={getMilestones(
                    primary,
                    outputCounts.get(primary.id) ?? 0,
                  )}
                />

                <div>
                  <Button variant="outline" size="sm" asChild>
                    <Link to={`/dashboard/projects/${primary.id}`}>
                      Open project
                    </Link>
                  </Button>
                </div>
              </div>
            </CardSection>
          ) : (
            <EmptyState
              icon={<FolderKanban className="h-6 w-6" />}
              title="No active projects"
              description="When you send us a request it appears here with its own progress rail, from review through to delivery."
              action={
                <Button asChild>
                  <Link to="/order">
                    <Plus className="h-4 w-4" />
                    Submit a request
                  </Link>
                </Button>
              }
            />
          )}

          {others.length > 0 && (
            <CardSection
              title="Other active projects"
              description="Everything else that is still moving."
            >
              <div className="space-y-4">
                {others.map((order) => (
                  <ProjectCard
                    key={order.id}
                    order={order}
                    outputCount={outputCounts.get(order.id) ?? 0}
                    to={`/dashboard/projects/${order.id}`}
                  />
                ))}
              </div>
            </CardSection>
          )}
        </div>

        <CardSection
          title="Recent updates"
          description="The latest movement on your projects."
          actions={
            <Button variant="ghost" size="sm" asChild>
              <Link to="/dashboard/notifications">See all</Link>
            </Button>
          }
        >
          <ActivityList
            items={activity}
            limit={5}
            orderLink={(id) => `/dashboard/projects/${id}`}
            emptyLabel="Updates appear here as your requests move forward."
          />
        </CardSection>
      </div>

      {recentFiles.length > 0 && (
        <CardSection
          className="mt-6"
          title="Latest documents"
          description="The most recent files shared or delivered."
          actions={
            <Button variant="outline" size="sm" asChild>
              <Link to="/dashboard/documents">All documents</Link>
            </Button>
          }
        >
          <div className="divide-y divide-border/70">
            {recentFiles.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                order={orderById.get(file.order_id)}
                uploaderName={uploaderNames.get(file.uploaded_by ?? "")}
              />
            ))}
          </div>
        </CardSection>
      )}
    </>
  );
}
