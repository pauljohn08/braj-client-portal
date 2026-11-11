import { Outlet } from "react-router-dom";

import { useAuth } from "@/hooks/useAuth";
import { AppShell } from "./AppShell";
import { PARTTIMER_NAV } from "./nav";
import { RequireRole } from "./route-guards";

function PartTimerShell() {
  const { user } = useAuth();
  const metadataName = user?.user_metadata?.full_name as string | undefined;

  return (
    <AppShell
      navGroups={PARTTIMER_NAV}
      roleLabel="Part-timer"
      brandTo="/parttimer"
      settingsTo="/parttimer/account"
      displayName={metadataName || user?.email || "Part-timer"}
      email={user?.email ?? ""}
    >
      <Outlet />
    </AppShell>
  );
}

export default function PartTimerLayout() {
  return (
    <RequireRole role="parttimer">
      <PartTimerShell />
    </RequireRole>
  );
}
