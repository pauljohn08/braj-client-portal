import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/useAuth";
import { BarChart3, LogOut, LayoutDashboard, User, Menu, X } from "lucide-react";

export function Header() {
  const { user, isAdmin, isPartTimer, isPendingPartTimer, signOut } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleSignOut = async () => {
    await signOut();
    setMobileOpen(false);
    navigate("/");
  };

  const dashboardLink = isAdmin ? "/admin" : isPartTimer ? "/parttimer" : isPendingPartTimer ? "/pending-parttimer" : "/dashboard";

  return (
    <header className="sticky top-0 z-50 border-b bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="container flex h-16 items-center justify-between">
        <Link to="/" className="flex items-center gap-2 font-bold text-xl text-primary">
          <BarChart3 className="h-6 w-6" />
          BRAJ Consultancy
        </Link>
        <nav className="hidden md:flex items-center gap-2">
          {user ? (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to={dashboardLink}>
                  <LayoutDashboard className="h-4 w-4 mr-1" />
                  {isPendingPartTimer ? "Pending approval" : "Dashboard"}
                </Link>
              </Button>
              {isAdmin && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/admin/account">
                    <User className="h-4 w-4 mr-1" />
                    Profile
                  </Link>
                </Button>
              )}
              {isPartTimer && !isAdmin && (
                <Button variant="ghost" size="sm" asChild>
                  <Link to="/parttimer/account">
                    <User className="h-4 w-4 mr-1" />
                    Account
                  </Link>
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={handleSignOut}>
                <LogOut className="h-4 w-4 mr-1" />
                Sign Out
              </Button>
            </>
          ) : (
            <>
              <Button variant="ghost" size="sm" asChild>
                <Link to="/auth">Log In</Link>
              </Button>
              <Button size="sm" asChild>
                <Link to="/auth?tab=signup">Sign Up</Link>
              </Button>
            </>
          )}
        </nav>
        <div className="md:hidden">
          <Button
            variant="ghost"
            size="icon"
            aria-label="Toggle menu"
            onClick={() => setMobileOpen((v) => !v)}
          >
            {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t bg-card">
          <div className="container flex flex-col gap-1 px-4 py-3">
            {user ? (
              <>
                <Link
                  to={dashboardLink}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  <LayoutDashboard className="h-4 w-4" />
                  {isPendingPartTimer ? "Pending approval" : "Dashboard"}
                </Link>
                {isAdmin && (
                  <Link
                    to="/admin/account"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <User className="h-4 w-4" />
                    Profile
                  </Link>
                )}
                {isPartTimer && !isAdmin && (
                  <Link
                    to="/parttimer/account"
                    onClick={() => setMobileOpen(false)}
                    className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                  >
                    <User className="h-4 w-4" />
                    Account
                  </Link>
                )}
                <button
                  type="button"
                  onClick={handleSignOut}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-destructive hover:bg-destructive/10"
                >
                  <LogOut className="h-4 w-4" />
                  Sign Out
                </button>
              </>
            ) : (
              <>
                <Link
                  to="/auth"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  Log In
                </Link>
                <Link
                  to="/auth?tab=signup"
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium text-foreground hover:bg-accent hover:text-accent-foreground"
                >
                  Sign Up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </header>
  );
}