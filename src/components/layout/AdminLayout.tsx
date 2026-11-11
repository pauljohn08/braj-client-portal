import { Outlet } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { AdminDataProvider, useAdminData } from "@/hooks/useAdminData";
import { displayName, quoteIsSet } from "@/lib/orders";
import { AppShell, NotificationBell } from "./AppShell";
import { ADMIN_NAV } from "./nav";
import { RequireRole } from "./route-guards";

function AdminShell() {
  const { user } = useAuth();
  const { orders, receipts, pendingPartTimers, profiles } = useAdminData();

  /**
   * The admin's standing to-do list: requests that still need a price, work
   * that has been delivered with a receipt waiting to be confirmed, and
   * part-timer applications awaiting a decision.
   */
  const awaitingPrice = orders.filter(
    (o) => o.status === "pending" && !quoteIsSet(o),
  ).length;
  const awaitingConfirmation = orders.filter(
    (o) =>
      o.status === "completed" &&
      !o.payment_received &&
      receipts.some((r) => r.order_id === o.id),
  ).length;
  const needsAttention =
    awaitingPrice + awaitingConfirmation + pendingPartTimers.length;

  const me = user ? profiles.get(user.id) : undefined;

  return (
    <AppShell
      navGroups={ADMIN_NAV}
      roleLabel="Admin console"
      brandTo="/admin"
      settingsTo="/admin/account"
      displayName={displayName(me, user?.email ?? "Administrator")}
      email={me?.email || user?.email || ""}
      badges={{ "/admin/requests": needsAttention }}
      topbarActions={
        <NotificationBell to="/admin/requests" count={needsAttention} />
      }
    >
      <Outlet />
    </AppShell>
  );
}

export default function AdminLayout() {
  return (
    <RequireRole role="admin">
      <AdminDataProvider>
        <AdminShell />
      </AdminDataProvider>
    </RequireRole>
  );
}
