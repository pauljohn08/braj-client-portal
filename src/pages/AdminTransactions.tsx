import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, Receipt, Banknote, CheckCircle } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { Tables } from "@/integrations/supabase/types";

type TransactionWithDetails = Tables<"transactions"> & {
  orders?: { title: string; user_id: string } | null;
  clientProfile?: { full_name: string; email: string } | null;
  parttimerProfile?: { full_name: string; email: string; gcash_number: string | null; gcash_name: string | null } | null;
};

export default function AdminTransactions() {
  const { user, isAdmin, isLoading } = useAuth();
  const navigate = useNavigate();
  const [transactions, setTransactions] = useState<TransactionWithDetails[]>([]);
  const [loading, setLoading] = useState(true);
  const [payParttimerTx, setPayParttimerTx] = useState<TransactionWithDetails | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isLoading && (!user || !isAdmin)) navigate("/auth");
  }, [user, isAdmin, isLoading, navigate]);

  useEffect(() => {
    if (!user || !isAdmin) return;
    const fetchData = async () => {
      const { data: txData } = await supabase
        .from("transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (!txData?.length) {
        setTransactions([]);
        setLoading(false);
        return;
      }
      const orderIds = txData.map((t) => t.order_id);
      const { data: ordersData } = await supabase.from("orders").select("id, title, user_id").in("id", orderIds);
      const orderMap = new Map((ordersData || []).map((o) => [o.id, o]));
      const userIds = [...new Set(txData.flatMap((t) => [orderMap.get(t.order_id)?.user_id, t.assigned_to].filter(Boolean)))];
      const { data: profilesData } = await supabase.from("profiles").select("user_id, full_name, email, gcash_number, gcash_name").in("user_id", userIds);
      const profileMap = new Map((profilesData || []).map((p) => [p.user_id, p]));

      setTransactions(
        txData.map((t) => {
          const order = orderMap.get(t.order_id);
          const ptProfile = t.assigned_to ? profileMap.get(t.assigned_to) : null;
          return {
            ...t,
            orders: order ?? null,
            clientProfile: order?.user_id ? profileMap.get(order.user_id) ?? null : null,
            parttimerProfile: ptProfile ? { full_name: ptProfile.full_name, email: ptProfile.email, gcash_number: ptProfile.gcash_number ?? null, gcash_name: ptProfile.gcash_name ?? null } : null,
          };
        })
      );
      setLoading(false);
    };
    fetchData();
  }, [user, isAdmin]);

  const submitParttimerReceipt = async () => {
    if (!payParttimerTx || !receiptFile) return;
    setUploading(true);
    const path = `admin-to-parttimer/${payParttimerTx.id}/${receiptFile.name}`;
    const { error: uploadError } = await supabase.storage.from("payment-receipts").upload(path, receiptFile, { upsert: true });
    if (uploadError) {
      toast({ title: "Upload failed", description: uploadError.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        parttimer_paid_at: new Date().toISOString(),
        parttimer_receipt_path: path,
        parttimer_receipt_name: receiptFile.name,
      })
      .eq("id", payParttimerTx.id);
    if (updateError) {
      toast({ title: "Error", description: updateError.message, variant: "destructive" });
      setUploading(false);
      return;
    }
    setTransactions((prev) =>
      prev.map((t) =>
        t.id === payParttimerTx.id
          ? { ...t, parttimer_paid_at: new Date().toISOString(), parttimer_receipt_path: path, parttimer_receipt_name: receiptFile.name }
          : t
      )
    );
    setPayParttimerTx(null);
    setReceiptFile(null);
    setUploading(false);
    toast({ title: "Part-timer marked as paid", description: "Receipt uploaded. Part-timer will see this as paid by admin." });
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
      <main className="flex-1 py-6 sm:py-8">
        <div className="container px-4">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 w-full sm:w-auto">
              <Button variant="ghost" size="sm" asChild className="w-full sm:w-auto">
                <Link to="/admin"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard</Link>
              </Button>
              <h1 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
                <Receipt className="h-6 w-6 sm:h-7 sm:w-7" /> Transaction History
              </h1>
            </div>
          </div>
          <p className="text-sm sm:text-base text-muted-foreground mb-4 sm:mb-6">Sharing per service: Owner and Part-timer %. Admin pays the part-timer their share. Total = order price for selected service.</p>

          {transactions.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-muted-foreground">
                <Receipt className="h-10 w-10 mx-auto mb-3 opacity-40" />
                <p>No transactions yet.</p>
                <p className="text-xs mt-1">Transactions are created when you confirm payment on a completed order.</p>
              </CardContent>
            </Card>
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>All transactions</CardTitle>
                <CardDescription>Payment confirmations with Owner / Part-timer split per service</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto -mx-4 sm:mx-0">
                  <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                    <table className="w-full text-xs sm:text-sm">
                      <thead>
                        <tr className="border-b">
                          <th className="text-left py-2 px-2 whitespace-nowrap">Date</th>
                          <th className="text-left py-2 px-2 whitespace-nowrap">Order</th>
                          <th className="text-left py-2 px-2 whitespace-nowrap">Client</th>
                          <th className="text-left py-2 px-2 whitespace-nowrap">Part-timer</th>
                          <th className="text-right py-2 px-2 whitespace-nowrap">Total</th>
                          <th className="text-right py-2 px-2 whitespace-nowrap">Owner</th>
                          <th className="text-right py-2 px-2 whitespace-nowrap">Part-timer</th>
                          <th className="text-center py-2 px-2 whitespace-nowrap">Pay</th>
                        </tr>
                      </thead>
                      <tbody>
                        {transactions.map((t) => (
                          <tr key={t.id} className="border-b last:border-0">
                            <td className="py-2 px-2 whitespace-nowrap">{new Date(t.created_at).toLocaleDateString()}</td>
                            <td className="py-2 px-2 max-w-[150px] truncate" title={t.orders?.title ?? "—"}>{t.orders?.title ?? "—"}</td>
                            <td className="py-2 px-2 max-w-[120px] truncate" title={t.clientProfile?.full_name || t.clientProfile?.email || "—"}>{t.clientProfile?.full_name || t.clientProfile?.email || "—"}</td>
                            <td className="py-2 px-2 max-w-[120px] truncate" title={t.parttimerProfile?.full_name || t.parttimerProfile?.email || "—"}>{t.parttimerProfile?.full_name || t.parttimerProfile?.email || "—"}</td>
                            <td className="text-right py-2 px-2 whitespace-nowrap">₱{Number(t.amount).toLocaleString()}</td>
                            <td className="text-right py-2 px-2 whitespace-nowrap">₱{Number(t.admin_amount).toLocaleString()}</td>
                            <td className="text-right py-2 px-2 whitespace-nowrap">₱{Number(t.parttimer_amount).toLocaleString()}</td>
                            <td className="text-center py-2 px-2">
                              {t.assigned_to && !t.parttimer_paid_at && (
                                <Button size="sm" variant="outline" onClick={() => { setPayParttimerTx(t); setReceiptFile(null); }} className="text-xs">
                                  <Banknote className="h-3 w-3 mr-1" /> <span className="hidden sm:inline">Pay part-timer</span><span className="sm:hidden">Pay</span>
                                </Button>
                              )}
                              {t.parttimer_paid_at && (
                                <Badge variant="outline" className="text-green-700 border-green-300 text-xs">
                                  <CheckCircle className="h-3 w-3 mr-1" /> <span className="hidden sm:inline">Paid</span>
                                </Badge>
                              )}
                              {!t.assigned_to && <span className="text-muted-foreground text-xs">—</span>}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          <Dialog open={!!payParttimerTx} onOpenChange={(open) => !open && setPayParttimerTx(null)}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Pay Part-timer</DialogTitle>
                <DialogDescription>
                  Upload receipt for paying part-timer: {payParttimerTx?.parttimerProfile?.full_name || payParttimerTx?.parttimerProfile?.email || "Unknown"}
                  {payParttimerTx?.parttimerProfile?.gcash_number && (
                    <>
                      <br />GCash: {payParttimerTx.parttimerProfile.gcash_number}
                      {payParttimerTx.parttimerProfile.gcash_name && ` (${payParttimerTx.parttimerProfile.gcash_name})`}
                    </>
                  )}
                  <br />Amount: ₱{payParttimerTx ? Number(payParttimerTx.parttimer_amount).toLocaleString() : "0"}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
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
                <Button variant="outline" onClick={() => { setPayParttimerTx(null); setReceiptFile(null); }}>Cancel</Button>
                <Button onClick={submitParttimerReceipt} disabled={!receiptFile || uploading}>
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                  Mark as paid
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
