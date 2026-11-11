import type { ReactNode } from "react";
import { Link, NavLink, useLocation, useNavigate } from "react-router-dom";
import { BarChart3, Bell, ChevronDown, LogOut } from "lucide-react";

import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { matchNavItem, type NavGroup } from "./nav";

/* -------------------------------------------------------------------------- */
/* Notification bell                                                           */
/* -------------------------------------------------------------------------- */

export function NotificationBell({ to, count }: { to: string; count: number }) {
  const label =
    count > 0 ? `Updates, ${count} new` : "Updates, nothing new";
  return (
    <Button
      variant="ghost"
      size="icon"
      asChild
      className="relative text-muted-foreground hover:text-foreground"
    >
      <Link to={to} aria-label={label}>
        <Bell className="h-5 w-5" />
        {count > 0 && (
          <span
            aria-hidden
            className="tabular absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-1 text-[10px] font-semibold leading-none text-primary-foreground"
          >
            {count > 9 ? "9+" : count}
          </span>
        )}
      </Link>
    </Button>
  );
}

/* -------------------------------------------------------------------------- */
/* Account menu                                                                */
/* -------------------------------------------------------------------------- */

function AccountMenu({
  displayName,
  email,
  settingsTo,
}: {
  displayName: string;
  email: string;
  settingsTo: string;
}) {
  const { signOut } = useAuth();
  const navigate = useNavigate();

  const initials =
    displayName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase() ?? "")
      .join("") || "?";

  const handleSignOut = async () => {
    await signOut();
    navigate("/");
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="flex items-center gap-2 rounded-lg px-1.5 py-1 text-left transition-colors hover:bg-accent"
        >
          <Avatar className="h-8 w-8 border border-border">
            <AvatarFallback className="bg-primary text-xs font-semibold text-primary-foreground">
              {initials}
            </AvatarFallback>
          </Avatar>
          <span className="hidden min-w-0 sm:block">
            <span className="block max-w-[10rem] truncate text-sm font-semibold leading-tight">
              {displayName}
            </span>
            <span className="block max-w-[10rem] truncate text-xs leading-tight text-muted-foreground">
              {email}
            </span>
          </span>
          <ChevronDown className="hidden h-4 w-4 shrink-0 text-muted-foreground sm:block" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        <DropdownMenuLabel className="font-normal">
          <span className="block truncate text-sm font-semibold">{displayName}</span>
          <span className="block truncate text-xs text-muted-foreground">{email}</span>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link to={settingsTo}>Profile and settings</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={handleSignOut}
          className="text-destructive focus:text-destructive"
        >
          <LogOut className="h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

/* -------------------------------------------------------------------------- */
/* Shell                                                                       */
/* -------------------------------------------------------------------------- */

export function AppShell({
  navGroups,
  roleLabel,
  brandTo,
  settingsTo,
  displayName,
  email,
  badges,
  topbarActions,
  children,
}: {
  navGroups: NavGroup[];
  roleLabel: string;
  brandTo: string;
  settingsTo: string;
  displayName: string;
  email: string;
  /** Nav path → count, shown as a badge on that item. */
  badges?: Record<string, number>;
  topbarActions?: ReactNode;
  children: ReactNode;
}) {
  const { pathname } = useLocation();
  const active = matchNavItem(pathname, navGroups);

  return (
    <SidebarProvider>
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:text-primary-foreground"
      >
        Skip to main content
      </a>

      <Sidebar collapsible="icon" className="border-r border-sidebar-border">
        <SidebarHeader className="border-b border-sidebar-border px-2 py-3">
          <Link
            to={brandTo}
            className="flex items-center gap-2.5 rounded-lg p-1.5 transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:justify-center"
          >
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
              <BarChart3 className="h-4 w-4" />
            </span>
            <span className="min-w-0 group-data-[collapsible=icon]:hidden">
              <span className="block font-display text-base font-semibold leading-tight text-sidebar-primary">
                BRAJ
              </span>
              <span className="block truncate text-[11px] leading-tight text-sidebar-foreground/70">
                {roleLabel}
              </span>
            </span>
          </Link>
        </SidebarHeader>

        <SidebarContent className="px-2 py-3">
          {navGroups.map((group, index) => (
            <SidebarGroup key={group.label ?? index} className="p-0 pb-4">
              {group.label && (
                <SidebarGroupLabel className="px-2 pb-1 text-xs font-medium text-sidebar-foreground/60">
                  {group.label}
                </SidebarGroupLabel>
              )}
              <SidebarGroupContent>
                <SidebarMenu className="gap-0.5">
                  {group.items.map((item) => {
                    const badgeCount = item.badge
                      ? (badges?.[item.to] ?? 0)
                      : 0;
                    return (
                      <SidebarMenuItem key={item.to}>
                        <SidebarMenuButton
                          asChild
                          isActive={active?.to === item.to}
                          tooltip={item.label}
                          className={cn(
                            "relative h-10 gap-3 rounded-lg px-3 text-sm font-medium",
                            "text-sidebar-foreground/85",
                            "before:absolute before:left-0 before:h-5 before:w-0.5 before:rounded-full before:bg-sidebar-primary before:opacity-0 before:transition-opacity",
                            "data-[active=true]:before:opacity-100",
                            "data-[active=true]:text-sidebar-accent-foreground",
                            "group-data-[collapsible=icon]:before:hidden",
                          )}
                        >
                          <NavLink to={item.to} end={item.end}>
                            <item.icon className="h-4 w-4 shrink-0" />
                            <span className="truncate group-data-[collapsible=icon]:hidden">
                              {item.label}
                            </span>
                          </NavLink>
                        </SidebarMenuButton>
                        {badgeCount > 0 && (
                          <SidebarMenuBadge className="bg-sidebar-primary text-sidebar-primary-foreground">
                            {badgeCount > 9 ? "9+" : badgeCount}
                          </SidebarMenuBadge>
                        )}
                      </SidebarMenuItem>
                    );
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          ))}
        </SidebarContent>

        <SidebarFooter className="border-t border-sidebar-border p-2">
          <p className="px-2 py-1 text-[11px] leading-relaxed text-sidebar-foreground/55 group-data-[collapsible=icon]:hidden">
            BRAJ Statistical and Research Consultancy
          </p>
        </SidebarFooter>

        <SidebarRail />
      </Sidebar>

      <SidebarInset className="bg-background">
        <header className="sticky top-0 z-30 flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background/85 px-4 backdrop-blur supports-[backdrop-filter]:bg-background/70 sm:px-6">
          <SidebarTrigger className="-ml-1 h-9 w-9 text-muted-foreground hover:text-foreground" />
          <span className="font-display text-sm font-semibold md:hidden">BRAJ</span>
          <div className="ml-auto flex items-center gap-1.5 sm:gap-2">
            {topbarActions}
            <span aria-hidden className="hidden h-6 w-px bg-border sm:block" />
            <AccountMenu
              displayName={displayName}
              email={email}
              settingsTo={settingsTo}
            />
          </div>
        </header>

        <div
          id="main-content"
          className="animate-rise flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8"
        >
          {children}
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
