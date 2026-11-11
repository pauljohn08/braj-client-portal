import {
  Activity,
  Bell,
  FolderKanban,
  FolderOpen,
  Inbox,
  LayoutDashboard,
  Receipt,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavItem = {
  to: string;
  label: string;
  icon: LucideIcon;
  /** Match this route exactly rather than as a prefix. */
  end?: boolean;
  /** Show the activity count beside this item. */
  badge?: "activity";
};

export type NavGroup = {
  label?: string;
  items: NavItem[];
};

export const CLIENT_NAV: NavGroup[] = [
  {
    items: [
      { to: "/dashboard", label: "Overview", icon: LayoutDashboard, end: true },
      { to: "/dashboard/projects", label: "My projects", icon: FolderKanban },
      { to: "/dashboard/requests", label: "Service requests", icon: Inbox },
      { to: "/dashboard/documents", label: "Documents", icon: FolderOpen },
      {
        to: "/dashboard/notifications",
        label: "Notifications",
        icon: Bell,
        badge: "activity",
      },
      { to: "/dashboard/profile", label: "Profile and settings", icon: Settings },
    ],
  },
];

export const ADMIN_NAV: NavGroup[] = [
  {
    label: "Operations",
    items: [
      { to: "/admin", label: "Overview", icon: LayoutDashboard, end: true },
      {
        to: "/admin/requests",
        label: "Service requests",
        icon: Inbox,
        badge: "activity",
      },
      { to: "/admin/projects", label: "Projects", icon: FolderKanban },
      { to: "/admin/clients", label: "Clients", icon: Users },
      { to: "/admin/documents", label: "Documents", icon: FolderOpen },
      { to: "/admin/transactions", label: "Transactions", icon: Receipt },
    ],
  },
  {
    label: "Administration",
    items: [
      { to: "/admin/parttimers", label: "Part-timers", icon: UserCog },
      { to: "/admin/activity", label: "Activity and audit", icon: Activity },
      { to: "/admin/account", label: "Settings", icon: Settings },
    ],
  },
];

/**
 * Appended to the client portal for someone who is also an admin. An admin can
 * sign in and land in their own (usually empty) client view; without this they
 * have no way back to the console.
 */
export const ADMIN_CONSOLE_NAV: NavGroup = {
  label: "Administration",
  items: [{ to: "/admin", label: "Admin console", icon: ShieldCheck, end: true }],
};

export const PARTTIMER_NAV: NavGroup[] = [
  {
    items: [
      { to: "/parttimer", label: "Work board", icon: FolderKanban, end: true },
      { to: "/parttimer/account", label: "Account", icon: Settings },
    ],
  },
];

/**
 * The longest nav path that prefixes the current location. Used for the page
 * title in the top bar and for highlighting the active item.
 */
export function matchNavItem(
  pathname: string,
  groups: NavGroup[],
): NavItem | undefined {
  const items = groups.flatMap((g) => g.items);
  return items
    .filter((item) =>
      item.end ? pathname === item.to : pathname.startsWith(item.to),
    )
    .sort((a, b) => b.to.length - a.to.length)[0];
}
