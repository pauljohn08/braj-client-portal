import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Download, Loader2, Search, PlayCircle, Upload, Lock, User } from "lucide-react";
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

type OrderWithProfile = Tables<"orders"> & { profiles?: { full_name: string; email: string } | null };

export default function PartTimerDashboard() {
  const { user, isPartTimer, isPendingPartTimer, isLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<OrderWithProfile[]>([]);
  const [files, setFiles] = useState<Tables<"order_files">[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [serviceFilter, setServiceFilter] = useState("all");
  const [allowedServices, setAllowedServices] = useState<string[] | null>(null);

  useEffect(() => {
    if (!isLoading && !user) navigate("/auth");
    else if (!isLoading && user && isPendingPartTimer) navigate("/pending-parttimer");
    else if (!isLoading && user && !isPartTimer) navigate("/auth");
  }, [user, isPartTimer, isPendingPartTimer, isLoading, navigate]);

  useEffect(() => {
    const loadAllowedServices = async () => {
      if (!user || !isPartTimer) return;
      const { data, error } = await supabase
        .from("parttimer_allowed_services")
        .select("service_type")
        .eq("parttimer_id", user.id);
      if (error) {
        setAllowedServices(null);
        return;
      }
      setAllowedServices((data || []).map((row: { service_type: string }) => row.service_type));
    };
    loadAllowedServices();
  }, [user, isPartTimer]);

  const fetchData = async () => {
    try {
      const { data: ordersData } = await supabase
        .from("orders")
        .select("*")
        .order("created_at", { ascending: false });

      if (ordersData && ordersData.length > 0) {
        const userIds = [...new Set(ordersData.map((o) => o.user_id))];
        const { data: profilesData } = await supabase
          .from("profiles")
          .select("user_id, full_name, email")
          .in("user_id", userIds);

        const profileMap = new Map(profilesData?.map((p) => [p.user_id, p]) || []);

        const enriched = ordersData.map((o) => ({
          ...o,
          profiles: profileMap.get(o.user_id) || null,
        }));
        setOrders(enriched);

        const orderIds = ordersData.map((o) => o.id);
        const { data: filesData } = await supabase
          .from("order_files")
          .select("*")
          .in("order_id", orderIds);

        const uploaderIds = [...new Set((filesData || []).map((f) => f.uploaded_by).filter(Boolean))];
        const { data: uploaderProfiles } = uploaderIds.length > 0
          ? await supabase.from("profiles").select("user_id, full_name, email").in("user_id", uploaderIds)
          : { data: [] };
        const uploaderMap = new Map((uploaderProfiles || []).map((p) => [p.user_id, p.full_name || p.email || "Unknown"]));
        setFiles(
          (filesData || []).map((f) => ({
            ...f,
            uploader_name: f.uploaded_by ? uploaderMap.get(f.uploaded_by) ?? "Unknown" : null,
          }))
        );
      } else {
        setOrders([]);
      }
    } catch {
      setOrders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user && isPartTimer) fetchData();
  }, [user, isPartTimer]);

  const canWorkOnService = (serviceType: string) => {
    if (!allowedServices || allowedServices.length === 0) return true;
    return allowedServices.includes(serviceType);
  };

  const markInProgress = async (orderId: string) => {
    if (!user) return;
    const order = orders.find((o) => o.id === orderId);
    if (!order) return;
    if (!canWorkOnService(order.service_type)) {
      toast({
        title: "Not allowed for this service",
        description: "Ask the admin to enable this service type for you.",
        variant: "destructive",
      });
      return;
    }
    const { error } = await supabase
      .from("orders")
      .update({ status: "in_progress", assigned_to: user.id })
      .eq("id", orderId)
      .is("assigned_to", null);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      toast({ title: "Order claimed", description: "You are now working on this order." });
      fetchData();
    }
  };

  const uploadOutputFiles = async (orderId: string, files: FileList) => {
    if (!user) return;
    const order = orders.find((o) => o.id === orderId);
    if (!order || order.assigned_to !== user.id) return;

    const fileArray = Array.from(files);
    let successCount = 0;
    let failCount = 0;

    for (const file of fileArray) {
      const filePath = `${order.user_id}/${orderId}/${file.name}`;
      const { error: uploadError } = await supabase.storage.from("output-files").upload(filePath, file);
      if (uploadError) {
        failCount++;
        toast({ title: `Upload failed: ${file.name}`, description: uploadError.message, variant: "destructive" });
        continue;
      }

      const { error: dbError } = await supabase.from("order_files").insert({
        order_id: orderId,
        file_type: "output" as const,
        file_path: filePath,
        file_name: file.name,
        uploaded_by: user.id,
      });
      if (dbError) {
        failCount++;
        toast({ title: `Error saving ${file.name}`, description: dbError.message, variant: "destructive" });
        continue;
      }
      successCount++;
    }

    if (successCount > 0) {
      const order = orders.find((o) => o.id === orderId);
      if (order && order.status === "in_progress") {
        const { error: updateError } = await supabase
          .from("orders")
          .update({ status: "completed" })
          .eq("id", orderId);
        if (updateError) {
          toast({ title: "Files uploaded but status update failed", variant: "destructive" });
        } else {
          toast({ 
            title: `${successCount} file(s) uploaded`, 
            description: failCount > 0 ? `${failCount} file(s) failed to upload.` : "The client can now download the finished files." 
          });
        }
      } else {
        toast({ 
          title: `${successCount} file(s) uploaded`, 
          description: failCount > 0 ? `${failCount} file(s) failed to upload.` : "Additional files added successfully." 
        });
      }
    }
    fetchData();
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

  const filtered = orders.filter((o) => {
    // Hide completed and paid orders
    if (o.status === "completed" && o.payment_received) return false;
    // Hide completed but unpaid orders unless assigned to current part-timer
    if (o.status === "completed" && !o.payment_received && o.assigned_to !== user?.id) return false;
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
      <main className="flex-1 py-6 sm:py-8">
        <div className="container px-4">
          <div className="mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <PlayCircle className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">Part-Timer Dashboard</h1>
                <p className="text-sm sm:text-base text-muted-foreground">View client orders, claim work, and upload finished files.</p>
              </div>
            </div>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap gap-3 mb-4 sm:mb-6">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by title or client..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="pending">Pending</SelectItem>
                <SelectItem value="in_progress">In Progress</SelectItem>
                <SelectItem value="completed">Completed</SelectItem>
              </SelectContent>
            </Select>
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
            <div className="grid gap-4 sm:gap-6 lg:grid-cols-3">
              <div className="lg:col-span-2 space-y-3">
                {filtered.map((order) => {
                  const isAssignedToOther = order.assigned_to != null && order.assigned_to !== user?.id;
                  const isAssignedToMe = order.assigned_to === user?.id;
                  const canSelect = !isAssignedToOther;
                  return (
                    <Card
                      key={order.id}
                      className={`transition-shadow ${canSelect ? "cursor-pointer hover:shadow-md" : "opacity-75 cursor-not-allowed"} ${selectedOrder === order.id ? "ring-2 ring-primary" : ""}`}
                      onClick={() => canSelect && setSelectedOrder(order.id)}
                    >
                      <CardContent className="py-4">
                        <div className="flex items-center justify-between">
                          <div>
                            <h3 className="font-semibold">{order.title}</h3>
                            <p className="text-sm text-muted-foreground">
                              {order.service_type} — {order.profiles?.full_name || order.profiles?.email || "Unknown"}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {new Date(order.created_at).toLocaleDateString()}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            <Badge className={statusColors[order.status]}>{statusLabels[order.status]}</Badge>
                            {isAssignedToOther && (
                              <Badge variant="secondary" className="text-xs">
                                <Lock className="h-3 w-3 mr-0.5 inline" /> In progress by another part-timer
                              </Badge>
                            )}
                            {isAssignedToMe && (
                              <Badge variant="default" className="text-xs">Your order</Badge>
                            )}
                            {order.payment_received && <Badge variant="outline" className="text-xs">Paid</Badge>}
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>

              <div>
                {selected ? (
                  <Card className="sticky top-20 max-h-[calc(100vh-6rem)] overflow-y-auto">
                    <CardHeader>
                      <CardTitle className="text-lg">{selected.title}</CardTitle>
                      <CardDescription>
                        {selected.service_type} — {selected.profiles?.full_name || "Unknown"}
                        <br />{selected.profiles?.email}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4 text-sm">
                      <div><strong>Tier:</strong> {selected.pricing_tier}</div>
                      <div><strong>Status:</strong> <Badge className={statusColors[selected.status]}>{statusLabels[selected.status]}</Badge></div>
                      {selected.instructions && <div><strong>Instructions:</strong> {selected.instructions}</div>}
                      {selected.deadline && <div><strong>Deadline:</strong> {selected.deadline}</div>}
                      {selected.chapter_count && <div><strong>Chapters:</strong> {selected.chapter_count}</div>}
                      {selected.word_count && <div><strong>Word Count:</strong> {selected.word_count}</div>}
                      {selected.payment_received && <div><Badge variant="outline">Payment Received</Badge></div>}

                      {/* Mark In Progress / Upload actions */}
                      {user && selected.assigned_to === null && selected.status === "pending" && (
                        <div className="space-y-2">
                          <Button
                            className="w-full"
                            disabled={!canWorkOnService(selected.service_type)}
                            onClick={() => markInProgress(selected.id)}
                          >
                            <PlayCircle className="h-4 w-4 mr-2" />
                            Mark as In Progress
                          </Button>
                          {allowedServices && allowedServices.length > 0 && !canWorkOnService(selected.service_type) && (
                            <p className="text-xs text-amber-700 text-center">
                              You are not allowed to work on this service. Please contact the admin if this is incorrect.
                            </p>
                          )}
                        </div>
                      )}
                      {user && selected.assigned_to === user.id && (selected.status === "in_progress" || (selected.status === "completed" && !selected.payment_received)) && (
                        <div>
                          <Button
                            variant="default"
                            className="w-full"
                            onClick={() => document.getElementById(`pt-upload-${selected.id}`)?.click()}
                          >
                            <Upload className="h-4 w-4 mr-2" />
                            Upload Finished File(s)
                          </Button>
                          <input
                            id={`pt-upload-${selected.id}`}
                            type="file"
                            multiple
                            className="hidden"
                            onChange={(e) => {
                              const files = e.target.files;
                              if (files && files.length > 0) {
                                uploadOutputFiles(selected.id, files);
                                e.target.value = "";
                              }
                            }}
                          />
                          <p className="text-xs text-muted-foreground mt-2 text-center">You can select multiple files</p>
                        </div>
                      )}

                      {/* Files - download */}
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
                      Select an order to view details
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
