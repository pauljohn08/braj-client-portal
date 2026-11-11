import { Link, Outlet } from "react-router-dom";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { ClientDataProvider, useClientData } from "@/hooks/useClientData";
import { displayName } from "@/lib/orders";
import { AppShell, NotificationBell } from "./AppShell";
import { ADMIN_CONSOLE_NAV, CLIENT_NAV } from "./nav";
import { RequireRole } from "./route-guards";

function ClientShell() {
  const { user, isAdmin } = useAuth();
  const { profile, unseenCount } = useClientData();

  return (
    <AppShell
      navGroups={isAdmin ? [...CLIENT_NAV, ADMIN_CONSOLE_NAV] : CLIENT_NAV}
      roleLabel="Client portal"
      brandTo="/dashboard"
      settingsTo="/dashboard/profile"
      displayName={displayName(profile, user?.email ?? "Client")}
      email={profile?.email || user?.email || ""}
      badges={{ "/dashboard/notifications": unseenCount }}
      topbarActions={
        <>
          <Button asChild size="sm" className="hidden sm:inline-flex">
            <Link to="/order">
              <Plus className="h-4 w-4" />
              Submit a request
            </Link>
          </Button>
          <NotificationBell to="/dashboard/notifications" count={unseenCount} />
        </>
      }
    >
      <Outlet />
    </AppShell>
  );
}

export default function ClientLayout() {
  return (
    <RequireRole role="client">
      <ClientDataProvider>
        <ClientShell />
      </ClientDataProvider>
    </RequireRole>
  );
}
