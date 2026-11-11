import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Inbox, Plus, Search, Trash2 } from "lucide-react";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { CardSection } from "@/components/app/CardSection";
import { ServiceGlyph } from "@/components/app/ServiceGlyph";
import { PageHeader } from "@/components/app/PageHeader";
import { StatusBadge, ToneBadge } from "@/components/app/Badges";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/app/States";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useClientData } from "@/hooks/useClientData";
import {
  formatCurrency,
  formatDate,
  quoteIsSet,
  relativeTime,
  statusHint,
} from "@/lib/orders";

const TABS = [
  { value: "all", label: "All requests" },
  { value: "pending", label: "Awaiting review" },
  { value: "in_progress", label: "In progress" },
  { value: "completed", label: "Completed" },
];

export default function Requests() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { orders, loading, error, refresh, removeOrderLocally } = useClientData();
  const [tab, setTab] = useState("all");
  const [query, setQuery] = useState("");
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return orders.filter((order) => {
      if (tab !== "all" && order.status !== tab) return false;
      if (!q) return true;
      return (
        order.title.toLowerCase().includes(q) ||
        order.service_type.toLowerCase().includes(q)
      );
    });
  }, [orders, query, tab]);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={refresh} />;

  const target = orders.find((order) => order.id === pendingDelete);

  const handleDelete = async () => {
    if (!user || !target) return;
    setDeleting(true);
    const { error: deleteError } = await supabase
      .from("orders")
      .delete()
      .eq("id", target.id)
      .eq("user_id", user.id);
    setDeleting(false);

    if (deleteError) {
      toast({
        title: "Could not withdraw the request",
        description: deleteError.message,
        variant: "destructive",
      });
      return;
    }

    removeOrderLocally(target.id);
    setPendingDelete(null);
    toast({
      title: "Request withdrawn",
      description: `"${target.title}" is no longer with us.`,
    });
  };

  return (
    <>
      <PageHeader
        title="Service requests"
        description="A request stays here while we review it, price it and turn it into a project."
        actions={
          <Button asChild>
            <Link to="/order">
              <Plus className="h-4 w-4" />
              Submit a request
            </Link>
          </Button>
        }
      />

      <CardSection
        title="Your requests"
        description="You can withdraw a request while it is still being reviewed."
        actions={
          orders.length > 0 ? (
            <div className="relative">
              <Search
                aria-hidden
                className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search requests"
                aria-label="Search requests"
                className="w-full pl-9 sm:w-64"
              />
            </div>
          ) : undefined
        }
      >
        {orders.length > 0 && (
          <Tabs value={tab} onValueChange={setTab} className="mb-5">
            <TabsList>
              {TABS.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        )}

        {filtered.length > 0 ? (
          <ul className="divide-y divide-border/70">
            {filtered.map((order) => (
              <li
                key={order.id}
                className="flex flex-wrap items-start gap-4 py-4 first:pt-0 last:pb-0"
              >
                <span
                  aria-hidden
                  className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent text-accent-foreground"
                >
                  <ServiceGlyph
                    serviceName={order.service_type}
                    className="h-5 w-5"
                  />
                </span>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate font-display text-base font-semibold text-foreground">
                      {order.title}
                    </h3>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    {order.service_type} — {order.pricing_tier}
                  </p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                    {statusHint(order)}
                  </p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ToneBadge tone="neutral" dot={false} className="tabular">
                      {quoteIsSet(order)
                        ? formatCurrency(order.amount)
                        : "Price to be confirmed"}
                    </ToneBadge>
                    <span className="tabular text-xs text-muted-foreground">
                      Sent {formatDate(order.created_at)} —{" "}
                      {relativeTime(order.created_at)}
                    </span>
                  </div>
                </div>

                <div className="flex shrink-0 items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => navigate(`/dashboard/projects/${order.id}`)}
                  >
                    View
                  </Button>
                  {order.status === "pending" && (
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Withdraw ${order.title}`}
                      className="text-destructive hover:bg-destructive-muted hover:text-destructive"
                      onClick={() => setPendingDelete(order.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ) : orders.length === 0 ? (
          <EmptyState
            icon={<Inbox className="h-6 w-6" />}
            title="No requests yet"
            description="Tell us what you need — a statistical analysis, a plagiarism report, editing — and it will appear here within minutes."
            action={
              <Button asChild>
                <Link to="/order">
                  <Plus className="h-4 w-4" />
                  Submit a request
                </Link>
              </Button>
            }
          />
        ) : (
          <div className="py-10 text-center">
            <p className="text-sm text-muted-foreground">
              No requests match this view.
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => {
                setQuery("");
                setTab("all");
              }}
            >
              Clear filters
            </Button>
          </div>
        )}
      </CardSection>

      <AlertDialog
        open={pendingDelete !== null}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Withdraw this request?</AlertDialogTitle>
            <AlertDialogDescription>
              {target
                ? `"${target.title}" and any files you attached will be removed. This cannot be undone.`
                : "This cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deleting}>Keep it</AlertDialogCancel>
            <AlertDialogAction
              disabled={deleting}
              onClick={(event) => {
                event.preventDefault();
                void handleDelete();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleting ? "Withdrawing…" : "Withdraw request"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
