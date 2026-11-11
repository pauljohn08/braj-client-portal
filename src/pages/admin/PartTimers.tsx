import { useState } from "react";
import { Loader2, UserCog, UserX } from "lucide-react";

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
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { CardSection } from "@/components/app/CardSection";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { ToneBadge } from "@/components/app/Badges";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/app/States";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAdminData } from "@/hooks/useAdminData";
import { SERVICES } from "@/lib/services";

export default function PartTimers() {
  const {
    partTimers,
    pendingPartTimers,
    loading,
    error,
    refresh,
    setPartTimerServicesLocally,
    removePartTimerLocally,
    removePendingPartTimerLocally,
  } = useAdminData();

  const [decisionUserId, setDecisionUserId] = useState<string | null>(null);
  const [rejectId, setRejectId] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [savingServicesFor, setSavingServicesFor] = useState<string | null>(null);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={refresh} />;

  const approve = async (userId: string) => {
    setDecisionUserId(userId);
    const { error: rpcError } = await supabase.rpc("approve_pending_parttimer", {
      _user_id: userId,
    });
    setDecisionUserId(null);

    if (rpcError) {
      toast({
        title: "Could not approve",
        description: rpcError.message,
        variant: "destructive",
      });
      return;
    }

    removePendingPartTimerLocally(userId);
    await refresh();
    toast({
      title: "Part-timer approved",
      description: "They can now sign in and pick up work from the board.",
    });
  };

  const reject = async (userId: string) => {
    setRejectId(null);
    setDecisionUserId(userId);
    const { error: rpcError } = await supabase.rpc("reject_pending_parttimer", {
      _user_id: userId,
    });
    setDecisionUserId(null);

    if (rpcError) {
      toast({
        title: "Could not reject",
        description: rpcError.message,
        variant: "destructive",
      });
      return;
    }

    removePendingPartTimerLocally(userId);
    toast({
      title: "Application rejected",
      description: "They keep full access to the app as a client.",
    });
  };

  const removeDirect = async (userId: string, name: string | null) => {
    const { error: allowedError } = await supabase
      .from("parttimer_allowed_services")
      .delete()
      .eq("parttimer_id", userId);
    if (allowedError) return allowedError;

    const { error: roleError } = await supabase
      .from("user_roles")
      .delete()
      .eq("user_id", userId)
      .eq("role", "parttimer");
    if (roleError) return roleError;

    const { error: clientError } = await supabase.from("user_roles").insert({
      user_id: userId,
      role: "client",
      name: name || "Client",
    });
    if (clientError && clientError.code !== "23505") return clientError;

    const { error: orderError } = await supabase
      .from("orders")
      .update({ assigned_to: null, status: "pending" })
      .eq("assigned_to", userId)
      .eq("status", "in_progress");

    return orderError;
  };

  const remove = async (userId: string, name: string) => {
    setDeleteId(null);
    setDecisionUserId(userId);

    const { error: rpcError } = await supabase.rpc("remove_parttimer", {
      _user_id: userId,
    });

    const needsFallback =
      !!rpcError &&
      (rpcError.code === "PGRST202" ||
        /could not find the function/i.test(rpcError.message));

    const finalError = needsFallback
      ? await removeDirect(userId, name || null)
      : rpcError;

    setDecisionUserId(null);

    if (finalError) {
      toast({
        title: "Could not remove",
        description: finalError.message,
        variant: "destructive",
      });
      return;
    }

    removePartTimerLocally(userId);
    toast({
      title: "Part-timer removed",
      description: "Their in-progress work went back to the queue. They keep client access.",
    });
  };

  const toggleService = async (
    userId: string,
    serviceType: string,
    enable: boolean,
    current: string[],
  ) => {
    setSavingServicesFor(userId);

    const { error: writeError } = enable
      ? await supabase
          .from("parttimer_allowed_services")
          .insert({ parttimer_id: userId, service_type: serviceType })
      : await supabase
          .from("parttimer_allowed_services")
          .delete()
          .eq("parttimer_id", userId)
          .eq("service_type", serviceType);

    setSavingServicesFor(null);

    if (writeError) {
      toast({
        title: "Could not update their services",
        description: writeError.message,
        variant: "destructive",
      });
      return;
    }

    setPartTimerServicesLocally(
      userId,
      enable
        ? Array.from(new Set([...current, serviceType]))
        : current.filter((item) => item !== serviceType),
    );
  };

  return (
    <>
      <PageHeader
        title="Part-timers"
        description="Approve applications and decide which services each person is allowed to work on."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="On the roster" value={partTimers.length} />
        <StatCard
          label="Applications pending"
          value={pendingPartTimers.length}
          tone={pendingPartTimers.length > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Work in progress"
          value={partTimers.reduce((sum, person) => sum + person.activeCount, 0)}
          tone="progress"
        />
        <StatCard
          label="Work delivered"
          value={partTimers.reduce(
            (sum, person) => sum + person.completedCount,
            0,
          )}
          tone="success"
        />
      </div>

      {pendingPartTimers.length > 0 && (
        <CardSection
          className="mb-6"
          title="Applications awaiting a decision"
          description="Approving gives them access to the work board immediately."
        >
          <ul className="divide-y divide-border/70">
            {pendingPartTimers.map((applicant) => {
              const busy = decisionUserId === applicant.userId;
              return (
                <li
                  key={applicant.userId}
                  className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0 last:pb-0"
                >
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-foreground">
                      {applicant.name}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {applicant.email}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <Button
                      size="sm"
                      disabled={busy}
                      onClick={() => void approve(applicant.userId)}
                    >
                      {busy ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : null}
                      Approve
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      className="text-destructive hover:bg-destructive-muted hover:text-destructive"
                      onClick={() => setRejectId(applicant.userId)}
                    >
                      Reject
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        </CardSection>
      )}

      <CardSection
        title="Roster"
        description="Part-timers can work on every service until you limit them here."
      >
        {partTimers.length === 0 ? (
          <EmptyState
            icon={<UserCog className="h-6 w-6" />}
            title="Nobody on the roster"
            description="Somebody who signs up as a part-timer will appear in the applications list above for you to approve."
          />
        ) : (
          <div className="space-y-4">
            {partTimers.map((person) => {
              const busy = savingServicesFor === person.userId;
              const decisionBusy = decisionUserId === person.userId;
              return (
                <div
                  key={person.userId}
                  className="rounded-lg border border-border p-4"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate font-display text-base font-semibold text-foreground">
                        {person.name}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {person.email}
                      </p>
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        {person.rating ? (
                          <ToneBadge tone="warning">
                            Rated {person.rating.avg.toFixed(1)} / 5 (
                            {person.rating.count} reviews)
                          </ToneBadge>
                        ) : (
                          <ToneBadge tone="neutral">No ratings yet</ToneBadge>
                        )}
                        <span className="tabular text-xs text-muted-foreground">
                          {person.activeCount} active
                        </span>
                        <span aria-hidden className="text-xs text-muted-foreground">
                          —
                        </span>
                        <span className="tabular text-xs text-muted-foreground">
                          {person.completedCount} completed
                        </span>
                      </div>
                      {(person.gcashNumber || person.gcashName) && (
                        <p className="tabular mt-2 text-xs text-muted-foreground">
                          GCash {person.gcashNumber || "—"}
                          {person.gcashName ? ` (${person.gcashName})` : ""}
                        </p>
                      )}
                    </div>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={decisionBusy}
                      className="shrink-0 text-destructive hover:bg-destructive-muted hover:text-destructive"
                      onClick={() => setDeleteId(person.userId)}
                    >
                      <UserX className="h-4 w-4" />
                      Remove
                    </Button>
                  </div>

                  <fieldset className="mt-4 border-t border-border/70 pt-4">
                    <legend className="mb-3 text-sm font-medium text-foreground">
                      Services they may work on
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {SERVICES.map((service) => {
                        const checked = person.allowedServices.includes(
                          service.name,
                        );
                        return (
                          <label
                            key={service.id}
                            className="flex cursor-pointer items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-muted/60"
                          >
                            <Checkbox
                              checked={checked}
                              disabled={busy}
                              aria-label={service.name}
                              onCheckedChange={(next) =>
                                void toggleService(
                                  person.userId,
                                  service.name,
                                  next === true,
                                  person.allowedServices,
                                )
                              }
                            />
                            {service.name}
                          </label>
                        );
                      })}
                    </div>
                    {person.allowedServices.length === 0 && (
                      <p className="mt-3 text-xs leading-relaxed text-muted-foreground">
                        Nothing selected, so this part-timer can see every
                        service.
                      </p>
                    )}
                  </fieldset>
                </div>
              );
            })}
          </div>
        )}
      </CardSection>

      <AlertDialog
        open={rejectId !== null}
        onOpenChange={(open) => {
          if (!open) setRejectId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reject this application?</AlertDialogTitle>
            <AlertDialogDescription>
              They will not be able to take work, but they keep their normal
              client access. You can approve them later if you change your mind.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Keep pending</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (rejectId) void reject(rejectId);
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Reject application
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove this part-timer?</AlertDialogTitle>
            <AlertDialogDescription>
              They lose access to the work board, and anything they were in the
              middle of goes back to the queue for somebody else to pick up. They
              keep their client access.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={(event) => {
                event.preventDefault();
                if (!deleteId) return;
                const person = partTimers.find(
                  (item) => item.userId === deleteId,
                );
                void remove(deleteId, person?.name ?? "");
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remove part-timer
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
