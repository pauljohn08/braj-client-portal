import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { SHARING_PER_SERVICE, getAmountFromService, SERVICES } from "@/lib/services";
import { fetchPartTimerRatings } from "@/lib/parttimer-ratings";
import { toast } from "@/hooks/use-toast";
import { Link } from "react-router-dom";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Download, Loader2, Search, List, Clock, CheckCircle, FileCheck, Receipt, Star, UserPlus, Trash2, LayoutDashboard } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

const statusColors: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800 border-yellow-200 dark:bg-yellow-950 dark:text-yellow-300 dark:border-yellow-800",
  in_progress: "bg-blue-100 text-blue-800 border-blue-200 dark:bg-blue-950 dark:text-blue-300 dark:border-blue-800",
  completed: "bg-green-100 text-green-800 border-green-200 dark:bg-green-950 dark:text-green-300 dark:border-green-800",
};

const statusLabels: Record<string, string> = {
  pending: "Pending",
  in_progress: "In Progress",
  completed: "Completed",
};

type OrderWithProfile = Tables<"orders"> & {
  profiles?: { full_name: string; email: string } | null;
  assigneeProfile?: { full_name: string; email: string } | null;
};

type PartTimerWithServices = {
  user_id: string;
  name: string | null;
  email: string;
  allowedServices: string[];
};

export default function AdminDashboard() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderWithProfile[]>([]);
  const [files, setFiles] = useState<Tables<"order_files">[]>([]);
  const [receipts, setReceipts] = useState<Tables<"payment_receipts">[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "pending" | "in_progress" | "completed">("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [partTimerRatings, setPartTimerRatings] = useState<Map<string, { avg: number; count: number }>>(new Map());
  const [pendingPartTimers, setPendingPartTimers] = useState<{ user_id: string; name: string | null; email: string }[]>([]);
  const [approvingUserId, setApprovingUserId] = useState<string | null>(null);
  const [rejectingUserId, setRejectingUserId] = useState<string | null>(null);
  const [rejectConfirmUserId, setRejectConfirmUserId] = useState<string | null>(null);
  const [partTimers, setPartTimers] = useState<PartTimerWithServices[]>([]);
  const [savingPartTimerId, setSavingPartTimerId] = useState<string | null>(null);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [deleteConfirmUserId, setDeleteConfirmUserId] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) navigate("/auth");
  }, [user, isAdmin, isLoading, navigate]);

  const fetchData = async () => {
    try {
      const { data: ordersData } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (ordersData && ordersData.length > 0) {
        const orderIds = ordersData.map((o) => o.id);
        const { data: filesData } = await supabase
          .from("order_files")
          .select("*")
          .in("order_id", orderIds);
        const { data: receiptsData } = await supabase
          .from("payment_receipts")
          .select("*")
          .in("order_id", orderIds);

        const userIds = [...new Set(ordersData.flatMap((o) => [o.user_id, o.assigned_to].filter(Boolean)))];
        const uploaderIds = [...new Set((filesData || []).map((f) => f.uploaded_by).filter(Boolean))];
        const allUserIds = [...new Set([...userIds, ...uploaderIds])];
        const { data: allProfilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", allUserIds);
        const fullProfileMap = new Map((allProfilesData || []).map((p) => [p.user_id, p]));

        const enriched = ordersData.map((o) => ({
          ...o,
          profiles: fullProfileMap.get(o.user_id) || null,
          assigneeProfile: o.assigned_to ? (fullProfileMap.get(o.assigned_to) || null) : null,
        }));
        setOrders(enriched);
        const assigneeIds = [...new Set(ordersData.map((o) => o.assigned_to).filter(Boolean))] as string[];
        const ratings = await fetchPartTimerRatings(assigneeIds);
        setPartTimerRatings(ratings);
        setFiles(
          (filesData || []).map((f) => ({
            ...f,
            uploader_name: f.uploaded_by
              ? (fullProfileMap.get(f.uploaded_by)?.full_name || fullProfileMap.get(f.uploaded_by)?.email || "Unknown")
              : null,
          }))
        );
        setReceipts(receiptsData || []);
      } else {
        setOrders([]);
      }
      const { data: pendingRoles } = await supabase.from("user_roles").select("user_id, name").eq("role", "pending_parttimer");
      if (pendingRoles && pendingRoles.length > 0) {
        const pids = pendingRoles.map((r) => r.user_id);
        const { data: profilesData } = await supabase.from("profiles").select("user_id, full_name, email").in("user_id", pids);
        const profileMap = new Map((profilesData || []).map((p) => [p.user_id, p]));
        setPendingPartTimers(
          pendingRoles.map((r) => ({
            user_id: r.user_id,
            name: r.name || profileMap.get(r.user_id)?.full_name || null,
            email: profileMap.get(r.user_id)?.email || "",
          }))
        );
      } else {
        setPendingPartTimers([]);
      }
      const { data: parttimerRoles, error: parttimerRolesError } = await supabase
        .from("user_roles")
        .select("user_id, name")
        .eq("role", "parttimer");
      if (!parttimerRolesError && parttimerRoles && parttimerRoles.length > 0) {
        const parttimerIds = parttimerRoles.map((r) => r.user_id);
        const { data: ptProfiles } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", parttimerIds);
        const ptProfileMap = new Map((ptProfiles || []).map((p) => [p.user_id, p]));
        const { data: allowedServicesRows, error: allowedError } = await supabase
          .from("parttimer_allowed_services")
          .select("parttimer_id, service_type")
          .in("parttimer_id", parttimerIds);
        const allowedMap = new Map<string, string[]>();
        if (!allowedError && allowedServicesRows) {
          for (const row of allowedServicesRows as { parttimer_id: string; service_type: string }[]) {
            const current = allowedMap.get(row.parttimer_id) || [];
            current.push(row.service_type);
            allowedMap.set(row.parttimer_id, current);
          }
        }
        setPartTimers(
          parttimerRoles.map((r) => {
            const profile = ptProfileMap.get(r.user_id);
            return {
              user_id: r.user_id,
              name: profile?.full_name || r.name || null,
              email: profile?.email || "",
              allowedServices: allowedMap.get(r.user_id) || [],
            };
          })
        );
      } else {
        setPartTimers([]);
      }
    } catch {
      setOrders([]);
      setPendingPartTimers([]);
      setPartTimers([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isAdmin) fetchData();
  }, [user, isAdmin]);

  useEffect(() => {
    setResearchAmountInput("");
  }, [selectedOrder]);

  const updateStatus = async (orderId: string, status: "pending" | "in_progress" | "completed") => {
    const { error } = await supabase.from("orders").update({ status }).eq("id", orderId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, status } : o)));
      toast({ title: "Status updated" });
    }
  };

  const setStatisticalPricingTier = async (orderId: string, tierName: string) => {
    const service = SERVICES.find((s) => s.name === "Statistical Analysis");
    const tier = service?.tiers.find((t) => t.name === tierName);
    if (!tier) return;
    const { error } = await supabase
      .from("orders")
      .update({ pricing_tier: tier.name, amount: tier.priceValue })
      .eq("id", orderId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, pricing_tier: tier.name, amount: tier.priceValue } : o)));
      toast({ title: "Pricing tier set", description: `${tier.name} — ₱${tier.priceValue.toLocaleString()}` });
    }
  };

  const [researchAmountInput, setResearchAmountInput] = useState("");
  const [settingResearchAmount, setSettingResearchAmount] = useState(false);
  const setResearchAmount = async (orderId: string, amount: number) => {
    if (!Number.isFinite(amount) || amount < 0) {
      toast({ title: "Invalid amount", variant: "destructive" });
      return;
    }
    setSettingResearchAmount(true);
    const { error } = await supabase
      .from("orders")
      .update({ pricing_tier: "Agreed amount", amount })
      .eq("id", orderId);
    setSettingResearchAmount(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, pricing_tier: "Agreed amount", amount } : o)));
      setResearchAmountInput("");
      toast({ title: "Research amount set", description: `₱${amount.toLocaleString()}` });
    }
  };

  const approvePartTimer = async (userId: string) => {
    setApprovingUserId(userId);
    const { error } = await supabase.rpc("approve_pending_parttimer", { _user_id: userId });
    setApprovingUserId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setPendingPartTimers((prev) => prev.filter((p) => p.user_id !== userId));
      toast({ title: "Part-timer approved", description: "They can now log in and access the part-timer dashboard." });
    }
  };

  const rejectPartTimer = async (userId: string) => {
    setRejectConfirmUserId(null);
    setRejectingUserId(userId);
    const { error } = await supabase.rpc("reject_pending_parttimer", { _user_id: userId });
    setRejectingUserId(null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setPendingPartTimers((prev) => prev.filter((p) => p.user_id !== userId));
      toast({ title: "Application rejected", description: "They can use the app as a client." });
    }
  };

  const removePartTimerDirect = async (userId: string, name: string | null) => {
    const { error: allowedError } = await supabase.from("parttimer_allowed_services").delete().eq("parttimer_id", userId);
    if (allowedError) return allowedError;
    const { error: roleError } = await supabase.from("user_roles").delete().eq("user_id", userId).eq("role", "parttimer");
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

  const deletePartTimer = async (userId: string) => {
    const partTimer = partTimers.find((pt) => pt.user_id === userId);
    setDeleteConfirmUserId(null);
    setDeletingUserId(userId);
    const { error } = await supabase.rpc("remove_parttimer", { _user_id: userId });
    const fallbackNeeded = !!error && (error.code === "PGRST202" || /could not find the function/i.test(error.message));
    const finalError = fallbackNeeded ? await removePartTimerDirect(userId, partTimer?.name || null) : error;
    setDeletingUserId(null);
    if (finalError) {
      toast({ title: "Error", description: finalError.message, variant: "destructive" });
      return;
    }
    setPartTimers((prev) => prev.filter((pt) => pt.user_id !== userId));
    setOrders((prev) =>
      prev.map((o) =>
        o.assigned_to === userId && o.status === "in_progress"
          ? { ...o, assigned_to: null, status: "pending", assigneeProfile: null }
          : o
      )
    );
    toast({ title: "Part-timer deleted", description: "They can still use the app as a client." });
  };

  const togglePayment = async (orderId: string, current: boolean) => {
    if (!current) {
      const order = orders.find((o) => o.id === orderId);
      const amount = Number(order?.amount) || (order ? getAmountFromService(order.service_type, order.pricing_tier) : 0);
      const sharing = SHARING_PER_SERVICE[order?.service_type ?? ""] ?? { ownerPct: 40, parttimerPct: 60 };
      const adminAmount = Math.round(amount * (sharing.ownerPct / 100) * 100) / 100;
      const parttimerAmount = Math.round(amount * (sharing.parttimerPct / 100) * 100) / 100;
      const { error: txError } = await supabase.from("transactions").insert({
        order_id: orderId,
        amount,
        admin_amount: adminAmount,
        parttimer_amount: parttimerAmount,
        assigned_to: order?.assigned_to ?? null,
      });
      if (txError) {
        toast({ title: "Error", description: txError.message, variant: "destructive" });
        return;
      }
    }
    const { error } = await supabase.from("orders").update({ payment_received: !current }).eq("id", orderId);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setOrders((prev) => prev.map((o) => (o.id === orderId ? { ...o, payment_received: !current } : o)));
      if (!current) toast({ title: "Payment confirmed", description: "Client can download files. Transaction recorded with sharing for this service." });
    }
  };

  const downloadFile = async (filePath: string, fileName: string, bucket: string) => {
    const { data, error } = await supabase.storage.from(bucket).download(filePath);
    if (error) {
      toast({ title: "Download failed", description: error.message, variant: "destructive" });
      return;
    }
    const url = URL.createObjectURL(data);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const selectedReceipt = selectedOrder ? receipts.find((r) => r.order_id === selectedOrder) : null;

  const filtered = orders.filter((o) => {
    if (statusFilter !== "all" && o.status !== statusFilter) return false;
    if (serviceFilter !== "all" && o.service_type !== serviceFilter) return false;
    if (searchTerm) {
      const s = searchTerm.toLowerCase();
      return (
        o.title.toLowerCase().includes(s) ||
        o.profiles?.full_name?.toLowerCase().includes(s) ||
        o.profiles?.email?.toLowerCase().includes(s)
      );
    }
    return true;
  });

  const selected = orders.find((o) => o.id === selectedOrder);
  const selectedFiles = files.filter((f) => f.order_id === selectedOrder);
  const serviceTypes = [...new Set(orders.map((o) => o.service_type))];

  const handleTogglePartTimerService = async (userId: string, serviceType: string, enable: boolean) => {
    setSavingPartTimerId(userId);
    if (enable) {
      const { error } = await supabase.from("parttimer_allowed_services").insert({
        parttimer_id: userId,
        service_type: serviceType,
      });
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    } else {
      const { error } = await supabase
        .from("parttimer_allowed_services")
        .delete()
        .eq("parttimer_id", userId)
        .eq("service_type", serviceType);
      if (error) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      }
    }
    setSavingPartTimerId(null);
    setPartTimers((prev) =>
      prev.map((pt) =>
        pt.user_id === userId
          ? {
              ...pt,
              allowedServices: enable
                ? Array.from(new Set([...pt.allowedServices, serviceType]))
                : pt.allowedServices.filter((s) => s !== serviceType),
            }
          : pt
      )
    );
  };

  if (loading) {
    return (
      <div className="flex min-h-screen flex-col">
        <Header />
        <div className="flex flex-1 items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      <Header />
      <main className="flex-1 py-8">
        <div className="container">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <LayoutDashboard className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">Admin Dashboard</h1>
                <p className="text-sm text-muted-foreground">Manage orders, part-timers, and payments.</p>
              </div>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/admin/transactions"><Receipt className="h-4 w-4 mr-1" /> Transaction History</Link>
            </Button>
          </div>

          {pendingPartTimers.length > 0 && (
            <Card className="mb-6 border-amber-200 bg-amber-50/50">
              <CardHeader className="pb-2">
                <CardTitle className="text-lg flex items-center gap-2">
                  <UserPlus className="h-5 w-5" />
                  Pending part-timer applications
                </CardTitle>
                <CardDescription>These users signed up as part-timers and cannot access the dashboard until you approve them.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {pendingPartTimers.map((p) => (
                    <div key={p.user_id} className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-amber-200 bg-background p-3">
                      <div>
                        <span className="font-medium">{p.name || "—"}</span>
                        {p.email && <span className="text-muted-foreground text-sm ml-2">({p.email})</span>}
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={!!approvingUserId || !!rejectingUserId}
                          onClick={() => setRejectConfirmUserId(p.user_id)}
                        >
                          {rejectingUserId === p.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Reject"}
                        </Button>
                        <Button
                          size="sm"
                          disabled={!!approvingUserId || !!rejectingUserId}
                          onClick={() => approvePartTimer(p.user_id)}
                        >
                          {approvingUserId === p.user_id ? <Loader2 className="h-4 w-4 animate-spin" /> : "Approve"}
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {partTimers.length > 0 && (
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="text-lg">Part-timer service access</CardTitle>
                <CardDescription>
                  Choose which services each part-timer is allowed to work on. If no services are selected for anyone, part-timers can work on all services.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                {partTimers.map((pt) => (
                  <div key={pt.user_id} className="border rounded-md p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                      <div>
                        <p className="font-medium">{pt.name || "—"}</p>
                        {pt.email && <p className="text-xs text-muted-foreground">{pt.email}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        {pt.allowedServices.length > 0 && (
                          <Badge variant="outline" className="text-xs">
                            {pt.allowedServices.length} service{pt.allowedServices.length > 1 ? "s" : ""} enabled
                          </Badge>
                        )}
                        <Button
                          size="sm"
                          variant="destructive"
                          disabled={!!deletingUserId || !!savingPartTimerId}
                          onClick={() => setDeleteConfirmUserId(pt.user_id)}
                        >
                          {deletingUserId === pt.user_id ? (
                            <Loader2 className="h-4 w-4 animate-spin" />
                          ) : (
                            <>
                              <Trash2 className="h-4 w-4 mr-1" /> Delete
                            </>
                          )}
                        </Button>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-3">
                      {SERVICES.map((service) => {
                        const checked = pt.allowedServices.includes(service.name);
                        return (
                          <label
                            key={service.name}
                            className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs cursor-pointer bg-background"
                          >
                            <Checkbox
                              checked={checked}
                              disabled={!!savingPartTimerId}
                              onCheckedChange={(value) =>
                                handleTogglePartTimerService(pt.user_id, service.name, Boolean(value))
                              }
                            />
                            <span>{service.name}</span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}

          <AlertDialog open={!!deleteConfirmUserId} onOpenChange={(open) => !open && setDeleteConfirmUserId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete this part-timer?</AlertDialogTitle>
                <AlertDialogDescription>
                  {(partTimers.find((pt) => pt.user_id === deleteConfirmUserId)?.name ||
                    partTimers.find((pt) => pt.user_id === deleteConfirmUserId)?.email ||
                    "This user") +
                    " will lose part-timer access. In-progress orders assigned to them will go back to pending. They can still use the app as a client."}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={() => deleteConfirmUserId && deletePartTimer(deleteConfirmUserId)}
                >
                  Delete
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          <AlertDialog open={!!rejectConfirmUserId} onOpenChange={(open) => !open && setRejectConfirmUserId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Reject part-timer application?</AlertDialogTitle>
                <AlertDialogDescription>
                  This user will no longer be pending. They can still use the app as a client.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button
                  variant="destructive"
                  onClick={() => rejectConfirmUserId && rejectPartTimer(rejectConfirmUserId)}
                >
                  Reject
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Order status tabs: All | Pending | In Progress | Completed */}
          <div className="flex flex-wrap gap-2 p-1 rounded-xl bg-muted/60 mb-6">
            {[
              { value: "all" as const, label: "All", icon: List, count: orders.length },
              { value: "pending" as const, label: "Pending", icon: Clock, count: orders.filter((o) => o.status === "pending").length },
              { value: "in_progress" as const, label: "In Progress", icon: Loader2, count: orders.filter((o) => o.status === "in_progress").length },
              { value: "completed" as const, label: "Completed", icon: CheckCircle, count: orders.filter((o) => o.status === "completed").length },
            ].map((tab) => (
              <Button
                key={tab.value}
                variant={statusFilter === tab.value ? "default" : "ghost"}
                size="sm"
                className="flex items-center gap-2"
                onClick={() => setStatusFilter(tab.value)}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
                <Badge variant={statusFilter === tab.value ? "secondary" : "outline"} className="ml-1">
                  {tab.count}
                </Badge>
              </Button>
            ))}
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={serviceFilter} onValueChange={setServiceFilter}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Services</SelectItem>
                {serviceTypes.map((s) => (
                  <SelectItem key={s} value={s}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {filtered.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Search className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No orders found.</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-3">
                {filtered.map((order) => (
                  <Card
                    key={order.id}
                    className={`cursor-pointer transition-shadow hover:shadow-md ${selectedOrder === order.id ? "ring-2 ring-primary" : ""}`}
                    onClick={() => setSelectedOrder(order.id)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{order.title}</h3>
                          <p className="text-sm text-muted-foreground">
                            {order.service_type} — Client: {order.profiles?.full_name || order.profiles?.email || "Unknown"}
                          </p>
                          {(order.status === "in_progress" || order.status === "completed") && order.assigneeProfile && (
                            <p className="text-xs text-muted-foreground flex items-center gap-1">
                              Part-timer: {order.assigneeProfile.full_name || order.assigneeProfile.email || "Unknown"}
                              {order.assigned_to && partTimerRatings.has(order.assigned_to) && (
                                <span className="inline-flex items-center text-amber-600">
                                  <Star className="h-3 w-3 fill-amber-500" /> {partTimerRatings.get(order.assigned_to)!.avg} ({partTimerRatings.get(order.assigned_to)!.count})
                                </span>
                              )}
                            </p>
                          )}
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex flex-col items-end gap-1">
                          <Badge className={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
                          {order.payment_received && <Badge variant="outline" className="text-xs">Paid</Badge>}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              <div>
                {selected ? (
                  <Card className="sticky top-20">
                    <CardHeader>
                      <CardTitle className="text-lg">{selected.title}</CardTitle>
                      <CardDescription>
                        {selected.service_type}
                        <br />Client: {selected.profiles?.full_name || selected.profiles?.email || "Unknown"}
                        {selected.profiles?.email && <> ({selected.profiles.email})</>}
                        {(selected.status === "in_progress" || selected.status === "completed") && selected.assigneeProfile && (
                          <>
                            <br />Part-timer: {selected.assigneeProfile.full_name || selected.assigneeProfile.email || "Unknown"}
                            {selected.assigned_to && partTimerRatings.has(selected.assigned_to) && (
                              <span className="inline-flex items-center gap-1 text-amber-600 ml-1">
                                <Star className="h-4 w-4 fill-amber-500" /> {partTimerRatings.get(selected.assigned_to)!.avg} ({partTimerRatings.get(selected.assigned_to)!.count} ratings)
                              </span>
                            )}
                          </>
                        )}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div><strong>Client:</strong> {selected.profiles?.full_name || selected.profiles?.email || "Unknown"}</div>
                      {(selected.status === "in_progress" || selected.status === "completed") && selected.assigneeProfile && (
                        <div>
                          <strong>Part-timer:</strong> {selected.assigneeProfile.full_name || selected.assigneeProfile.email || "Unknown"}
                          {selected.assigned_to && partTimerRatings.has(selected.assigned_to) && (
                            <span className="inline-flex items-center gap-1 text-amber-600 ml-1">
                              <Star className="h-4 w-4 fill-amber-500" /> {partTimerRatings.get(selected.assigned_to)!.avg} ({partTimerRatings.get(selected.assigned_to)!.count})
                            </span>
                          )}
                        </div>
                      )}
                      <div><strong>Tier:</strong> {selected.pricing_tier}</div>
                      {selected.service_type === "Statistical Analysis" && selected.pricing_tier === "To be set by admin" && (
                        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <strong className="text-amber-800">Set pricing tier (required before client pays)</strong>
                          <Select
                            value=""
                            onValueChange={(v) => setStatisticalPricingTier(selected.id, v)}
                          >
                            <SelectTrigger><SelectValue placeholder="Select tier" /></SelectTrigger>
                            <SelectContent>
                              <SelectItem value="Basic (Descriptive Statistics)">Basic — ₱1,500</SelectItem>
                              <SelectItem value="Moderate (Inferential - Basic Comparison & Relationship)">Moderate — ₱2,500</SelectItem>
                              <SelectItem value="Advanced (Multivariate & Predictive Analysis)">Advanced — ₱4,000</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                      )}
                      {selected.service_type === "Research" && (Number(selected.amount) === 0 || selected.pricing_tier === "To be set by admin" || selected.pricing_tier === "Open Quotation") && (
                        <div className="space-y-2 rounded-lg border border-amber-200 bg-amber-50 p-3">
                          <strong className="text-amber-800">Set Research amount (required before client pays)</strong>
                          <p className="text-xs text-amber-700">Contact Baltazar Abobo for an agreement, then set the agreed amount here.</p>
                          <div className="flex flex-wrap gap-2 items-center">
                            <Input
                              type="number"
                              min={0}
                              step={0.01}
                              placeholder="Amount (₱)"
                              value={researchAmountInput}
                              onChange={(e) => setResearchAmountInput(e.target.value)}
                              className="w-32"
                            />
                            <Button
                              size="sm"
                              disabled={settingResearchAmount || !researchAmountInput || Number(researchAmountInput) <= 0}
                              onClick={() => setResearchAmount(selected.id, Number(researchAmountInput))}
                            >
                              {settingResearchAmount ? <Loader2 className="h-3 w-3 animate-spin" /> : "Set amount"}
                            </Button>
                          </div>
                        </div>
                      )}
                      {selected.instructions && <div><strong>Instructions:</strong> {selected.instructions}</div>}
                      {selected.deadline && <div><strong>Deadline:</strong> {selected.deadline}</div>}
                      {selected.chapter_count && <div><strong>Chapters:</strong> {selected.chapter_count}</div>}
                      {selected.word_count && <div><strong>Word Count:</strong> {selected.word_count}</div>}

                      {/* Status Update */}
                      <div className="space-y-2">
                        <strong>Update Status:</strong>
                        <Select
                          value={selected.status}
                          onValueChange={(v) => updateStatus(selected.id, v as any)}
                        >
                          <SelectTrigger><SelectValue /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="pending">Pending</SelectItem>
                            <SelectItem value="in_progress">In Progress</SelectItem>
                            <SelectItem value="completed">Completed</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      {/* Payment */}
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Checkbox
                            checked={selected.payment_received}
                            onCheckedChange={() => togglePayment(selected.id, selected.payment_received)}
                          />
                          <span>Payment Received</span>
                        </div>
                        {selected.service_type === "Statistical Analysis" && selected.pricing_tier === "To be set by admin" && (
                          <p className="text-xs text-amber-700">Set the pricing tier above before confirming payment.</p>
                        )}
                        {selected.service_type === "Research" && (Number(selected.amount) === 0 || selected.pricing_tier === "To be set by admin" || selected.pricing_tier === "Open Quotation") && (
                          <p className="text-xs text-amber-700">Set the Research amount above before confirming payment. Contact Baltazar Abobo for an agreement.</p>
                        )}
                        {selected.status === "completed" && !selected.payment_received && selectedReceipt && (selected.service_type !== "Statistical Analysis" || selected.pricing_tier !== "To be set by admin") && (selected.service_type !== "Research" || (Number(selected.amount) > 0 && selected.pricing_tier !== "To be set by admin" && selected.pricing_tier !== "Open Quotation")) && (
                          <div className="space-y-2 pt-1">
                            <div className="rounded-md border bg-muted/40 p-3 text-xs">
                              {(() => {
                                const sharing = SHARING_PER_SERVICE[selected.service_type] ?? { ownerPct: 40, parttimerPct: 60 };
                                const amt = Number(selected.amount ?? 0);
                                const ownerAmt = (amt * sharing.ownerPct / 100).toFixed(2);
                                const ptAmt = (amt * sharing.parttimerPct / 100).toFixed(2);
                                return (
                                  <>
                                    <p className="font-medium mb-1">Quotation — {selected.service_type}: Owner {sharing.ownerPct}% / Part-timer {sharing.parttimerPct}%</p>
                                    <p>Total: ₱{amt.toLocaleString()} → Owner: ₱{ownerAmt} | Part-timer: ₱{ptAmt}</p>
                                    <p className="text-muted-foreground mt-1">Admin will pay the part-timer their share.</p>
                                  </>
                                );
                              })()}
                            </div>
                            <div className="flex flex-wrap gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => downloadFile(selectedReceipt.file_path, selectedReceipt.file_name, "payment-receipts")}
                              >
                                <Download className="h-3 w-3 mr-1" /> View receipt
                              </Button>
                              <Button size="sm" onClick={() => togglePayment(selected.id, false)}>
                                <FileCheck className="h-3 w-3 mr-1" /> Confirm payment
                              </Button>
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Files */}
                      {selectedFiles.length > 0 && (
                        <div>
                          <strong>Files:</strong>
                          <div className="mt-2 space-y-1">
                            {selectedFiles.map((f) => (
                              <div key={f.id} className="space-y-0.5">
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full justify-start text-xs"
                                  onClick={() => downloadFile(f.file_path, f.file_name, f.file_type === "input" ? "input-files" : "output-files")}
                                >
                                  <Download className="h-3 w-3 mr-1" />
                                  {f.file_name} ({f.file_type})
                                </Button>
                                {"uploader_name" in f && (f as { uploader_name?: string }).uploader_name && (
                                  <p className="text-xs text-muted-foreground pl-2">uploaded by {(f as { uploader_name: string }).uploader_name}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                ) : (
                  <Card>
                    <CardContent className="py-8 text-center text-muted-foreground text-sm">
                      Select an order to manage
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </main>
      <Footer />
    </div>
  );
}
