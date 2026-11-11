import { Link } from "react-router-dom";
import { Inbox, ReceiptText, UserCheck, UserCog } from "lucide-react";

import { CardSection } from "@/components/app/CardSection";
import { ActivityList } from "@/components/app/ActivityList";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { StatusBadge, ToneBadge } from "@/components/app/Badges";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/app/States";
import { useAdminData } from "@/hooks/useAdminData";
import { formatCurrency, quoteIsSet, relativeTime } from "@/lib/orders";

/**
 * The admin's landing page. Everything on it is a decision that is currently
 * waiting for a human, or a snapshot of the roster — no charts, because none of
 * these numbers are trends.
 */
export default function Overview() {
  const {
    orders,
    receipts,
    activity,
    partTimers,
    pendingPartTimers,
    nameFor,
    loading,
    error,
    refresh,
  } = useAdminData();

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={refresh} />;

  const withReceipt = new Set(receipts.map((receipt) => receipt.order_id));

  const awaitingPrice = orders.filter(
    (order) => order.status === "pending" && !quoteIsSet(order),
  );
  const awaitingWork = orders.filter(
    (order) =>
      order.status === "pending" &&
      quoteIsSet(order) &&
      order.assigned_to === null,
  );
  const awaitingConfirm = orders.filter(
    (order) =>
      order.status === "completed" &&
      !order.payment_received &&
      withReceipt.has(order.id),
  );

  const requestLink = (id: string) => `/admin/requests?order=${id}`;

  return (
    <>
      <PageHeader
        title="Overview"
        description="What needs a decision today, and what is already moving."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Awaiting a price"
          value={awaitingPrice.length}
          tone="warning"
          icon={<Inbox className="h-4 w-4" />}
          hint="Requests we have not quoted yet."
          to="/admin/requests"
        />
        <StatCard
          label="Awaiting a consultant"
          value={awaitingWork.length}
          tone="progress"
          icon={<UserCheck className="h-4 w-4" />}
          hint="Priced, but nobody has picked it up."
          to="/admin/requests"
        />
        <StatCard
          label="Awaiting confirmation"
          value={awaitingConfirm.length}
          tone="info"
          icon={<ReceiptText className="h-4 w-4" />}
          hint="Receipts submitted, payment not confirmed."
          to="/admin/requests"
        />
        <StatCard
          label="Part-timer applications"
          value={pendingPartTimers.length}
          icon={<UserCog className="h-4 w-4" />}
          hint="Waiting for a decision."
          to="/admin/parttimers"
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardSection
            title="Requests awaiting a price"
            description="These cannot start until we agree an amount."
            actions={
              <Link
                to="/admin/requests"
                className="text-sm font-medium text-brand underline-offset-4 hover:underline"
              >
                Go to service requests
              </Link>
            }
          >
            {awaitingPrice.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Every request has been priced.
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {awaitingPrice.slice(0, 5).map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {order.title}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {order.service_type} — {nameFor(order.user_id)} —{" "}
                        {relativeTime(order.created_at)}
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <StatusBadge status={order.status} />
                      <Link
                        to={requestLink(order.id)}
                        className="text-sm font-medium text-brand underline-offset-4 hover:underline"
                      >
                        Price it
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardSection>

          <CardSection
            title="Delivered, awaiting payment confirmation"
            description="The client has sent a receipt. Confirm it to release their files."
          >
            {awaitingConfirm.length === 0 ? (
              <p className="py-8 text-center text-sm text-muted-foreground">
                Nothing is waiting on a payment confirmation.
              </p>
            ) : (
              <ul className="divide-y divide-border/70">
                {awaitingConfirm.slice(0, 5).map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {order.title}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {nameFor(order.user_id)} —{" "}
                        <span className="tabular">
                          {formatCurrency(order.amount)}
                        </span>
                      </p>
                    </div>
                    <div className="flex shrink-0 items-center gap-2">
                      <ToneBadge tone="info">Receipt received</ToneBadge>
                      <Link
                        to={`/admin/projects?order=${order.id}`}
                        className="text-sm font-medium text-brand underline-offset-4 hover:underline"
                      >
                        Confirm
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardSection>
        </div>

        <div className="space-y-6">
          <CardSection
            title="Recent activity"
            description="The last few things that happened."
          >
            <ActivityList
              items={activity}
              limit={8}
              orderLink={(id) => `/admin/projects?order=${id}`}
              emptyLabel="Nothing has happened yet."
            />
          </CardSection>

          <CardSection
            title="Part-timers"
            description="Who is available and how much they are carrying."
          >
            {partTimers.length === 0 ? (
              <EmptyState
                icon={<UserCog className="h-6 w-6" />}
                title="No part-timers yet"
                description="Approved applicants appear here with the services they are allowed to work on."
              />
            ) : (
              <ul className="divide-y divide-border/70">
                {partTimers.map((person) => (
                  <li key={person.userId} className="py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-foreground">
                          {person.name}
                        </p>
                        <p className="truncate text-xs text-muted-foreground">
                          {person.email}
                        </p>
                      </div>
                      {person.rating ? (
                        <ToneBadge tone="warning">
                          {person.rating.avg.toFixed(1)} / 5 (
                          {person.rating.count})
                        </ToneBadge>
                      ) : (
                        <ToneBadge tone="neutral">No ratings yet</ToneBadge>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span className="tabular">
                        {person.allowedServices.length} services enabled
                      </span>
                      <span aria-hidden>—</span>
                      <span className="tabular">
                        {person.activeCount} active
                      </span>
                      <span aria-hidden>—</span>
                      <span className="tabular">
                        {person.completedCount} completed
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </CardSection>
        </div>
      </div>
    </>
  );
}
