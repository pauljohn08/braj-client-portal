/**
 * Domain helpers for BRAJ engagements.
 *
 * The database calls these records `orders`, but a client experiences one as a
 * *request* while it is being reviewed and as a *project* once work begins. The
 * interface uses those words; this module keeps the mapping in one place so the
 * vocabulary stays consistent across every page.
 *
 * Nothing here invents data. Every value is derived from columns that already
 * exist on `orders`, `order_files`, `payment_receipts`, `order_ratings` and
 * `transactions`, or from the client's own "last seen" marker in localStorage.
 */

import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isValid,
} from "date-fns";
import type { Tables } from "@/integrations/supabase/types";

export type Order = Tables<"orders">;
export type OrderFile = Tables<"order_files">;
export type PaymentReceipt = Tables<"payment_receipts">;
export type OrderRating = Tables<"order_ratings">;
export type Transaction = Tables<"transactions">;
export type Profile = Tables<"profiles">;
export type OrderStatus = Order["status"];

export type Tone =
  | "neutral"
  | "info"
  | "progress"
  | "success"
  | "warning"
  | "danger";

/* -------------------------------------------------------------------------- */
/* Status                                                                      */
/* -------------------------------------------------------------------------- */

export const STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Awaiting review",
  in_progress: "In progress",
  completed: "Completed",
};

export const STATUS_TONE: Record<OrderStatus, Tone> = {
  pending: "warning",
  in_progress: "progress",
  completed: "success",
};

/** What the status actually means for the client, in one sentence. */
export function statusHint(order: Order): string {
  if (order.status === "pending") {
    return quoteIsSet(order)
      ? "Reviewed and priced. Waiting for a consultant to begin."
      : "BRAJ is reviewing your request and will confirm the scope and price.";
  }
  if (order.status === "in_progress") {
    return "Work is underway. You will be notified when files are ready.";
  }
  return order.payment_received
    ? "Delivered and settled. Your files are available to download."
    : "Work is delivered. Confirm payment to download your files.";
}

/** A request is priced once an amount has been agreed. */
export function quoteIsSet(order: Order): boolean {
  return Number(order.amount ?? 0) > 0;
}

/* -------------------------------------------------------------------------- */
/* Milestones                                                                  */
/* -------------------------------------------------------------------------- */

export type MilestoneState = "done" | "current" | "upcoming";

export type Milestone = {
  key: "submitted" | "quoted" | "started" | "delivered" | "settled";
  label: string;
  detail: string;
  state: MilestoneState;
};

/**
 * The engagement pipeline, in the order it actually happens for this business:
 * a client submits, BRAJ quotes, work starts, work is delivered, payment is
 * confirmed. Each milestone is read from a real column — no milestone is ever
 * shown as reached unless its column says so.
 */
export function getMilestones(order: Order, outputFileCount = 0): Milestone[] {
  const quoted = quoteIsSet(order);
  const started = order.assigned_to !== null;
  const delivered = order.status === "completed" && outputFileCount > 0;
  const settled = order.payment_received;

  const reached: boolean[] = [true, quoted, started, delivered, settled];

  // The first unreached milestone is "current"; everything after is upcoming.
  const currentIndex = reached.findIndex((r) => !r);

  const raw: Omit<Milestone, "state">[] = [
    {
      key: "submitted",
      label: "Request submitted",
      detail: "We received your request and its attachments.",
    },
    {
      key: "quoted",
      label: "Scope and price confirmed",
      detail: quoted
        ? `Agreed at ${formatCurrency(order.amount)}.`
        : "We confirm what is included and what it costs.",
    },
    {
      key: "started",
      label: "Work started",
      detail: started
        ? "A consultant has been assigned to your request."
        : "A consultant picks up the work once the scope is agreed.",
    },
    {
      key: "delivered",
      label: "Files delivered",
      detail: delivered
        ? "Your finished files are ready to download."
        : "You receive your finished files here.",
    },
    {
      key: "settled",
      label: "Payment confirmed",
      detail: settled
        ? "Payment received. Nothing further is owed."
        : "Settle the agreed amount to release your files.",
    },
  ];

  return raw.map((m, i) => ({
    ...m,
    state: reached[i] ? "done" : i === currentIndex ? "current" : "upcoming",
  }));
}

/** Share of the pipeline complete, 0–100. */
export function getProgressPercent(order: Order, outputFileCount = 0): number {
  const milestones = getMilestones(order, outputFileCount);
  const done = milestones.filter((m) => m.state === "done").length;
  return Math.round((done / milestones.length) * 100);
}

/** The single most useful thing to say about where a project stands. */
export function progressSummary(order: Order, outputFileCount = 0): string {
  const current = getMilestones(order, outputFileCount).find(
    (m) => m.state === "current",
  );
  return current ? current.label : "Complete";
}

/* -------------------------------------------------------------------------- */
/* Required client action                                                      */
/* -------------------------------------------------------------------------- */

export type ClientAction = {
  kind: "pay" | "awaiting-confirmation" | "rate" | "upload-receipt";
  label: string;
  detail: string;
  orderId: string;
  orderTitle: string;
  tone: Tone;
};

/**
 * Everything blocking the client, or worth their attention, drawn from receipt,
 * payment and rating state. Returned newest-first.
 */
export function getClientActions(
  orders: Order[],
  receipts: PaymentReceipt[],
  ratings: OrderRating[],
): ClientAction[] {
  const receiptByOrder = new Map(receipts.map((r) => [r.order_id, r]));
  const ratedOrders = new Set(ratings.map((r) => r.order_id));
  const actions: ClientAction[] = [];

  for (const order of orders) {
    const receipt = receiptByOrder.get(order.id);

    if (order.status === "completed" && !order.payment_received) {
      if (receipt) {
        actions.push({
          kind: "awaiting-confirmation",
          label: "Payment under review",
          detail:
            "We have your receipt and are confirming it. Your files unlock as soon as it clears.",
          orderId: order.id,
          orderTitle: order.title,
          tone: "info",
        });
      } else if (quoteIsSet(order)) {
        actions.push({
          kind: "pay",
          label: `Pay ${formatCurrency(order.amount)}`,
          detail:
            "Your work is delivered. Settle the agreed amount to download your files.",
          orderId: order.id,
          orderTitle: order.title,
          tone: "warning",
        });
      }
    }

    if (
      order.status === "completed" &&
      order.payment_received &&
      !ratedOrders.has(order.id)
    ) {
      actions.push({
        kind: "rate",
        label: "Rate this project",
        detail: "Tell us how it went — optional, and it helps other clients.",
        orderId: order.id,
        orderTitle: order.title,
        tone: "neutral",
      });
    }
  }

  return actions;
}

/* -------------------------------------------------------------------------- */
/* Deadlines                                                                   */
/* -------------------------------------------------------------------------- */

export type DeadlineInfo = {
  label: string;
  tone: Tone;
};

export function getDeadlineInfo(order: Order): DeadlineInfo | null {
  if (!order.deadline) return null;
  const parsed = new Date(order.deadline);
  if (!isValid(parsed)) return null;

  const days = differenceInCalendarDays(parsed, new Date());
  const settled = order.status === "completed";

  if (settled) {
    return { label: `Was due ${format(parsed, "d MMM yyyy")}`, tone: "neutral" };
  }
  if (days < 0) {
    return {
      label: `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} past due`,
      tone: "danger",
    };
  }
  if (days === 0) return { label: "Due today", tone: "warning" };
  if (days <= 3) {
    return {
      label: `Due in ${days} day${days === 1 ? "" : "s"}`,
      tone: "warning",
    };
  }
  return { label: `Due ${format(parsed, "d MMM yyyy")}`, tone: "neutral" };
}

/* -------------------------------------------------------------------------- */
/* Formatting                                                                  */
/* -------------------------------------------------------------------------- */

export function formatCurrency(value: number | string | null | undefined): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n)) return "₱0";
  return `₱${n.toLocaleString("en-PH", {
    minimumFractionDigits: n % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return isValid(parsed) ? format(parsed, "d MMM yyyy") : "—";
}

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return "—";
  const parsed = new Date(value);
  return isValid(parsed) ? format(parsed, "d MMM yyyy, h:mm a") : "—";
}

export function relativeTime(value: string | null | undefined): string {
  if (!value) return "";
  const parsed = new Date(value);
  if (!isValid(parsed)) return "";
  return formatDistanceToNowStrict(parsed, { addSuffix: true });
}

export function fileBucket(fileType: OrderFile["file_type"]): string {
  return fileType === "input" ? "input-files" : "output-files";
}

/** Output files are withheld until the client has paid for delivered work. */
export function isFileLocked(file: OrderFile, order: Order | undefined): boolean {
  if (!order) return false;
  return (
    file.file_type === "output" &&
    order.status === "completed" &&
    !order.payment_received
  );
}

/** Human label for the two document directions. */
export function fileRoleLabel(fileType: OrderFile["file_type"]): string {
  return fileType === "input" ? "You shared" : "Delivered to you";
}

/* -------------------------------------------------------------------------- */
/* Activity feed                                                               */
/* -------------------------------------------------------------------------- */

export type ActivityKind =
  | "request-submitted"
  | "input-uploaded"
  | "output-uploaded"
  | "receipt-uploaded"
  | "payment-confirmed"
  | "rated";

export type ActivityItem = {
  id: string;
  kind: ActivityKind;
  title: string;
  detail: string;
  at: string;
  orderId: string | null;
  orderTitle: string | null;
};

/**
 * A reverse-chronological feed built from real rows and their real timestamps.
 * `orders.updated_at` is deliberately not used as an event time — it only tells
 * us the row changed, not what changed — so delivery is dated from the newest
 * output file instead.
 */
export function buildActivity(input: {
  orders: Order[];
  files: OrderFile[];
  receipts: PaymentReceipt[];
  ratings: OrderRating[];
  transactions: Transaction[];
}): ActivityItem[] {
  const { orders, files, receipts, ratings, transactions } = input;
  const orderById = new Map(orders.map((o) => [o.id, o]));
  const items: ActivityItem[] = [];

  const base = (orderId: string) => {
    const order = orderById.get(orderId);
    return { orderId, orderTitle: order?.title ?? null };
  };

  for (const order of orders) {
    items.push({
      id: `order-${order.id}`,
      kind: "request-submitted",
      title: "Request submitted",
      detail: `${order.service_type} — ${order.pricing_tier}`,
      at: order.created_at,
      ...base(order.id),
    });
  }

  for (const file of files) {
    if (!orderById.has(file.order_id)) continue;
    items.push({
      id: `file-${file.id}`,
      kind: file.file_type === "output" ? "output-uploaded" : "input-uploaded",
      title:
        file.file_type === "output" ? "Files delivered" : "Files you shared",
      detail: file.file_name,
      at: file.created_at,
      ...base(file.order_id),
    });
  }

  for (const receipt of receipts) {
    if (!orderById.has(receipt.order_id)) continue;
    items.push({
      id: `receipt-${receipt.id}`,
      kind: "receipt-uploaded",
      title: "Receipt submitted",
      detail: receipt.file_name,
      at: receipt.created_at,
      ...base(receipt.order_id),
    });
  }

  for (const tx of transactions) {
    if (!orderById.has(tx.order_id)) continue;
    items.push({
      id: `tx-${tx.id}`,
      kind: "payment-confirmed",
      title: "Payment confirmed",
      detail: formatCurrency(tx.amount),
      at: tx.created_at,
      ...base(tx.order_id),
    });
  }

  for (const rating of ratings) {
    if (!orderById.has(rating.order_id)) continue;
    items.push({
      id: `rating-${rating.id || rating.order_id}`,
      kind: "rated",
      title: "Feedback submitted",
      detail: rating.rating ? `${rating.rating} out of 5` : "Skipped",
      at: rating.created_at,
      ...base(rating.order_id),
    });
  }

  return items.sort(
    (a, b) => new Date(b.at).getTime() - new Date(a.at).getTime(),
  );
}

/* -------------------------------------------------------------------------- */
/* Per-user "last seen" marker for the activity feed                           */
/* -------------------------------------------------------------------------- */

const seenKey = (userId: string) => `braj:activity-seen:${userId}`;

export function getActivitySeenAt(userId: string): number {
  try {
    const raw = localStorage.getItem(seenKey(userId));
    return raw ? Number(raw) || 0 : 0;
  } catch {
    return 0;
  }
}

export function setActivitySeenAt(userId: string, timestamp: number): void {
  try {
    localStorage.setItem(seenKey(userId), String(timestamp));
  } catch {
    /* storage unavailable — the badge simply stays as it was */
  }
}

export function countUnseen(items: ActivityItem[], seenAt: number): number {
  return items.filter((i) => new Date(i.at).getTime() > seenAt).length;
}

/* -------------------------------------------------------------------------- */
/* Part-timer attribution                                                      */
/* -------------------------------------------------------------------------- */

export function displayName(
  profile: Pick<Profile, "full_name" | "email"> | null | undefined,
  fallback = "Unknown",
): string {
  if (!profile) return fallback;
  return profile.full_name?.trim() || profile.email || fallback;
}
