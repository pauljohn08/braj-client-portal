import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Download, Plus, Clock, Loader2, Lock, CreditCard, Star, Trash2, ClipboardList } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { getAmountFromService } from "@/lib/services";
import type { Tables } from "@/integrations/supabase/types";

const GCASH_NUMBER = "09155090144";
const GCASH_NAME = "Baltazar R. Abobo Jr.";

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

export default function Dashboard() {
  const { user, isAdmin, isPartTimer, isPendingPartTimer, isLoading } = useAuth();
  const navigate = useNavigate();
  const [orders, setOrders] = useState<Tables<"orders">[]>([]);
  const [files, setFiles] = useState<Tables<"order_files">[]>([]);
  const [receipts, setReceipts] = useState<Tables<"payment_receipts">[]>([]);
  const [ratings, setRatings] = useState<Tables<"order_ratings">[]>([]);
  const [loading, setLoading] = useState(true);
  const [ratingStars, setRatingStars] = useState<number | null>(null);
  const [ratingTestimony, setRatingTestimony] = useState("");
  const [submittingRating, setSubmittingRating] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<string | null>(null);
  const [payDialogOrderId, setPayDialogOrderId] = useState<string | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [deleteOrderId, setDeleteOrderId] = useState<string | null>(null);
  const [deletingOrder, setDeletingOrder] = useState(false);

  useEffect(() => {
    if (!isLoading && !user) navigate("/auth");
    else if (!isLoading && user && isPendingPartTimer) navigate("/pending-parttimer");
    else if (!isLoading && user && isPartTimer && !isAdmin) navigate("/parttimer");
  }, [user, isAdmin, isPartTimer, isPendingPartTimer, isLoading, navigate]);

  useEffect(() => {
    if (!user) return;
    const fetchData = async () => {
      const { data: ordersData } = await supabase
        .from("orders")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      setOrders(ordersData || []);

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
        const { data: ratingsData } = await supabase
          .from("order_ratings")
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
        setReceipts(receiptsData || []);
        setRatings(ratingsData || []);
      }
      setLoading(false);
    };
    fetchData();
  }, [user]);

  const downloadFile = async (filePath: string, fileName: string, bucket: string, isOutput?: boolean) => {
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
    if (isOutput && canRate) {
      toast({ title: "Download complete", description: "Consider rating your part-timer below (optional)." });
    }
  };

  const submitRating = async () => {
    if (!selectedOrder || !user) return;
    setSubmittingRating(true);
    const { error } = await supabase.from("order_ratings").insert({
      order_id: selectedOrder,
      rating: ratingStars ?? null,
      testimony: ratingTestimony.trim() || null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setRatings((prev) => [...prev, { id: "", order_id: selectedOrder, rating: ratingStars, testimony: ratingTestimony.trim() || null, created_at: new Date().toISOString() }]);
      setRatingStars(null);
      setRatingTestimony("");
      toast({ title: "Thank you!", description: "Your feedback has been submitted." });
    }
    setSubmittingRating(false);
  };

  const skipRating = async () => {
    if (!selectedOrder || !user) return;
    setSubmittingRating(true);
    const { error } = await supabase.from("order_ratings").insert({
      order_id: selectedOrder,
      rating: null,
      testimony: null,
    });
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setRatings((prev) => [...prev, { id: "", order_id: selectedOrder, rating: null, testimony: null, created_at: new Date().toISOString() }]);
      toast({ title: "Skipped" });
    }
    setSubmittingRating(false);
  };

  const selected = orders.find((o) => o.id === selectedOrder);
  const selectedFiles = files.filter((f) => f.order_id === selectedOrder);
  const selectedReceipt = selectedOrder ? receipts.find((r) => r.order_id === selectedOrder) : null;
  const selectedRating = selectedOrder ? ratings.find((r) => r.order_id === selectedOrder) : null;
  const canRate = selected && selected.status === "completed" && selected.payment_received && selected.assigned_to && !selectedRating;

  const deleteOrder = async () => {
    if (!deleteOrderId || !user) return;
    const order = orders.find((o) => o.id === deleteOrderId);
    if (!order || order.status !== "pending") {
      toast({ title: "Cannot delete", description: "Only pending orders can be deleted.", variant: "destructive" });
      setDeleteOrderId(null);
      return;
    }
    setDeletingOrder(true);
    const { error } = await supabase.from("orders").delete().eq("id", deleteOrderId).eq("user_id", user.id);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
    } else {
      setOrders((prev) => prev.filter((o) => o.id !== deleteOrderId));
      setFiles((prev) => prev.filter((f) => f.order_id !== deleteOrderId));
      setReceipts((prev) => prev.filter((r) => r.order_id !== deleteOrderId));
      setRatings((prev) => prev.filter((r) => r.order_id !== deleteOrderId));
      if (selectedOrder === deleteOrderId) setSelectedOrder(null);
      toast({ title: "Order deleted" });
    }
    setDeleteOrderId(null);
    setDeletingOrder(false);
  };

  const submitReceipt = async () => {
    if (!payDialogOrderId || !receiptFile || !user) return;
    setUploadingReceipt(true);
    const orderId = payDialogOrderId;
    const path = `${orderId}/${receiptFile.name}`;
    const { error: uploadError } = await supabase.storage.from("payment-receipts").upload(path, receiptFile, { upsert: true });
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploadingReceipt(false);
      return;
    }
    const { error: upsertError } = await supabase.from("payment_receipts").upsert(
      { order_id: orderId, file_path: path, file_name: receiptFile.name },
      { onConflict: "order_id" }
    );
    if (upsertError) {
      toast({ title: "Failed to save receipt", description: upsertError.message, variant: "destructive" });
      setUploadingReceipt(false);
      return;
    }
    setReceipts((prev) => {
      const rest = prev.filter((r) => r.order_id !== orderId);
      return [...rest, { id: "", order_id: orderId, file_path: path, file_name: receiptFile.name, created_at: new Date().toISOString() }];
    });
    setPayDialogOrderId(null);
    setReceiptFile(null);
    setUploadingReceipt(false);
    toast({ title: "Receipt submitted", description: "Admin will confirm your payment. You can download files once confirmed." });
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
                <ClipboardList className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold">My Orders</h1>
                <p className="text-sm text-muted-foreground">Track orders, download files, and rate completed work.</p>
              </div>
            </div>
            <Button asChild>
              <a href="/order"><Plus className="h-4 w-4 mr-1" /> New Order</a>
            </Button>
          </div>

          {orders.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Clock className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>No orders yet. Place your first order to get started!</p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid gap-6 lg:grid-cols-3">
              {/* Order List */}
              <div className="lg:col-span-2 space-y-3">
                {orders.map((order) => (
                  <Card
                    key={order.id}
                    className={`cursor-pointer transition-shadow hover:shadow-md ${selectedOrder === order.id ? "ring-2 ring-primary" : ""}`}
                    onClick={() => setSelectedOrder(order.id)}
                  >
                    <CardContent className="py-4">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="font-semibold">{order.title}</h3>
                          <p className="text-sm text-muted-foreground">{order.service_type} — {order.pricing_tier}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(order.created_at).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge className={statusColors[order.status]}>
                          {statusLabels[order.status]}
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Order Detail */}
              <div>
                {selected ? (
                  <Card className="sticky top-20">
                    <CardHeader>
                      <CardTitle className="text-lg">{selected.title}</CardTitle>
                      <CardDescription>{selected.service_type}</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3 text-sm">
                      <div><strong>Tier:</strong> {selected.pricing_tier}</div>
                      <div><strong>Amount to pay:</strong> ₱{(Number(selected.amount) || getAmountFromService(selected.service_type, selected.pricing_tier)).toLocaleString()}</div>
                      <div><strong>Status:</strong> <Badge className={statusColors[selected.status]}>{statusLabels[selected.status]}</Badge></div>
                      {selected.status === "completed" && (
                        <div className="space-y-2">
                          {selected.payment_received ? (
                            <Badge variant="outline" className="text-green-700 border-green-300">Payment received</Badge>
                          ) : selectedReceipt ? (
                            <p className="text-sm text-blue-600">Receipt submitted — awaiting admin confirmation.</p>
                          ) : (
                            <>
                              <p className="text-sm text-amber-600">Payment required to download completed files.</p>
                              <Button size="sm" onClick={() => { setPayDialogOrderId(selected.id); setReceiptFile(null); }}>
                                <CreditCard className="h-3 w-3 mr-1" /> Pay
                              </Button>
                            </>
                          )}
                          {!selected.payment_received && selectedReceipt && (
                            <Button size="sm" variant="outline" onClick={() => { setPayDialogOrderId(selected.id); setReceiptFile(null); }}>
                              Replace receipt
                            </Button>
                          )}
                        </div>
                      )}
                      {selected.instructions && <div><strong>Instructions:</strong> {selected.instructions}</div>}
                      {selected.deadline && <div><strong>Deadline:</strong> {selected.deadline}</div>}
                      {selected.chapter_count && <div><strong>Chapters:</strong> {selected.chapter_count}</div>}
                      {selected.word_count && <div><strong>Word Count:</strong> {selected.word_count}</div>}

                      {selected.status === "pending" && (
                        <div className="pt-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-destructive border-destructive/50 hover:bg-destructive/10"
                            onClick={() => setDeleteOrderId(selected.id)}
                          >
                            <Trash2 className="h-3 w-3 mr-1" />
                            Delete order
                          </Button>
                          <p className="text-xs text-muted-foreground mt-1">Only pending orders can be deleted.</p>
                        </div>
                      )}

                      {canRate && (
                        <div className="rounded-lg border border-dashed p-4 space-y-3">
                          <p className="text-sm font-medium">Rate your experience (optional)</p>
                          <div className="flex items-center gap-1">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <button
                                key={n}
                                type="button"
                                className="p-0.5 hover:scale-110 transition-transform"
                                onClick={() => setRatingStars(ratingStars === n ? null : n)}
                                aria-label={`${n} star${n > 1 ? "s" : ""}`}
                              >
                                <Star className={`h-7 w-7 ${ratingStars !== null && n <= ratingStars ? "fill-amber-400 text-amber-500" : "text-muted-foreground"}`} />
                              </button>
                            ))}
                            <span className="text-xs text-muted-foreground ml-1">1-5 stars</span>
                          </div>
                          <div>
                            <p className="text-xs text-muted-foreground mb-1">Testimony (optional, shown on main page)</p>
                            <Textarea
                              placeholder="Share your experience..."
                              value={ratingTestimony}
                              onChange={(e) => setRatingTestimony(e.target.value)}
                              className="min-h-[60px] text-sm"
                            />
                          </div>
                          <div className="flex gap-2">
                            <Button size="sm" onClick={submitRating} disabled={submittingRating}>
                              {submittingRating ? <Loader2 className="h-3 w-3 animate-spin mr-1" /> : null}
                              Submit
                            </Button>
                            <Button size="sm" variant="ghost" onClick={skipRating} disabled={submittingRating}>
                              Skip
                            </Button>
                          </div>
                        </div>
                      )}

                      {selectedRating && (
                        <p className="text-sm text-muted-foreground">You rated this order{selectedRating.rating ? ` ${selectedRating.rating} stars` : ""}.</p>
                      )}

                      {selectedFiles.length > 0 && (
                        <div>
                          <strong>Files:</strong>
                          <div className="mt-2 space-y-1">
                            {selectedFiles.map((f) => {
                              const isOutput = f.file_type === "output";
                              const paymentRequired = isOutput && selected.status === "completed" && !selected.payment_received;
                              const bucket = f.file_type === "input" ? "input-files" : "output-files";
                              return (
                                <div key={f.id} className="space-y-0.5">
                                  {paymentRequired ? (
                                    <div className="rounded-md border px-3 py-2 text-xs bg-muted/50">
                                      <div className="flex items-center gap-2 text-muted-foreground">
                                        <Lock className="h-3 w-3 shrink-0" />
                                        <span>{f.file_name} (output)</span>
                                      </div>
                                      <p className="mt-1 text-muted-foreground">Pay first to download this file.</p>
                                    </div>
                                  ) : (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="w-full justify-start text-xs"
                                      onClick={() => downloadFile(f.file_path, f.file_name, bucket, isOutput)}
                                    >
                                      <Download className="h-3 w-3 mr-1" />
                                      {f.file_name} ({f.file_type})
                                    </Button>
                                  )}
                                  {"uploader_name" in f && (f as { uploader_name?: string }).uploader_name && (
                                    <p className="text-xs text-muted-foreground pl-2">uploaded by {(f as { uploader_name: string }).uploader_name}</p>
                                  )}
                                </div>
                              );
                            })}
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

          {/* Delete order confirmation */}
          <AlertDialog open={!!deleteOrderId} onOpenChange={(open) => !open && setDeleteOrderId(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete order?</AlertDialogTitle>
                <AlertDialogDescription>
                  Are you sure you want to delete this order? This cannot be undone. Only pending orders can be deleted.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={deletingOrder}>Cancel</AlertDialogCancel>
                <Button
                  variant="destructive"
                  disabled={deletingOrder}
                  onClick={deleteOrder}
                >
                  {deletingOrder ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Delete
                </Button>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>

          {/* Pay / Receipt upload dialog */}
          <Dialog open={!!payDialogOrderId} onOpenChange={(open) => { if (!open) { setPayDialogOrderId(null); setReceiptFile(null); } }}>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Pay via GCash</DialogTitle>
                <DialogDescription>Send payment to the details below, then upload your receipt.</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                {payDialogOrderId && (() => {
                  const order = orders.find((o) => o.id === payDialogOrderId);
                  if (!order) return null;
                  const amt = Number(order.amount) || getAmountFromService(order.service_type, order.pricing_tier);
                  return amt > 0 ? (
                    <div className="rounded-lg border border-primary/30 bg-primary/5 p-3">
                      <p className="text-sm font-medium">Amount to pay</p>
                      <p className="text-xl font-semibold">₱{amt.toLocaleString()}</p>
                      <p className="text-xs text-muted-foreground mt-1">This amount will appear as the total in your transaction once payment is confirmed.</p>
                    </div>
                  ) : null;
                })()}
                <div className="rounded-lg border bg-muted/30 p-4 space-y-1">
                  <p className="text-sm font-medium">GCash number</p>
                  <p className="text-lg font-mono tracking-wider">{GCASH_NUMBER}</p>
                  <p className="text-sm font-medium mt-2">Account name</p>
                  <p className="text-lg">{GCASH_NAME}</p>
                </div>
                <div>
                  <p className="text-sm font-medium mb-2">Upload receipt</p>
                  <Input
                    type="file"
                    accept="image/*,.pdf"
                    onChange={(e) => setReceiptFile(e.target.files?.[0] ?? null)}
                  />
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => { setPayDialogOrderId(null); setReceiptFile(null); }}>Cancel</Button>
                <Button onClick={submitReceipt} disabled={!receiptFile || uploadingReceipt}>
                  {uploadingReceipt ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Submit receipt
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      </main>
      <Footer />
    </div>
  );
}
