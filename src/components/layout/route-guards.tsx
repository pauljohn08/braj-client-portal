import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { LoadingState } from "@/components/app/States";
import { useAuth } from "@/hooks/useAuth";

export type PortalRole = "client" | "admin" | "parttimer";

/**
 * Where a signed-in user belongs when they land somewhere they may not be.
 *
 * The order matters: an application still under review outranks everything,
 * and someone who is both an admin and a part-timer is sent to the admin
 * console. Every redirect below targets this one path, which is what stops a
 * user with mixed roles from bouncing between two routes forever.
 */
export function homePathFor(roles: {
  isAdmin: boolean;
  isPartTimer: boolean;
  isPendingPartTimer: boolean;
}): string {
  if (roles.isPendingPartTimer) return "/pending-parttimer";
  if (roles.isAdmin) return "/admin";
  if (roles.isPartTimer) return "/parttimer";
  return "/dashboard";
}

/**
 * Renders a portal only for a user who is allowed to see it. Regular clients
 * are the default role, so the client portal is open to anyone who is not a
 * part-timer — an admin visiting it simply sees their own (usually empty)
 * client view, which is how the portal behaved before.
 */
export function RequireRole({
  role,
  children,
}: {
  role: PortalRole;
  children: ReactNode;
}) {
  const roles = useAuth();

  if (roles.isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <LoadingState label="Preparing your workspace" />
      </div>
    );
  }

  if (!roles.user) return <Navigate to="/auth" replace />;

  if (roles.isPendingPartTimer) {
    return <Navigate to="/pending-parttimer" replace />;
  }

  const allowed =
    role === "admin"
      ? roles.isAdmin
      : role === "parttimer"
        ? roles.isPartTimer
        : !roles.isPartTimer || roles.isAdmin;

  if (!allowed) return <Navigate to={homePathFor(roles)} replace />;

  return <>{children}</>;
}
