import { useState } from "react";
import { Banknote, Receipt } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { CardSection } from "@/components/app/CardSection";
import { PageHeader } from "@/components/app/PageHeader";
import { StatCard } from "@/components/app/StatCard";
import { ToneBadge } from "@/components/app/Badges";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/app/States";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAdminData } from "@/hooks/useAdminData";
import { downloadReceipt } from "@/lib/download";
import { formatCurrency, formatDate, type Transaction } from "@/lib/orders";

const OVERDUE_MS = 7 * 24 * 60 * 60 * 1000;

export default function Transactions() {
  const {
    transactions,
    orders,
    profiles,
    nameFor,
    loading,
    error,
    refresh,
    setTransactionLocally,
  } = useAdminData();

  const [payTarget, setPayTarget] = useState<Transaction | null>(null);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={refresh} />;

  const orderById = new Map(orders.map((order) => [order.id, order]));

  const gross = transactions.reduce((sum, tx) => sum + Number(tx.amount), 0);
  const owner = transactions.reduce(
    (sum, tx) => sum + Number(tx.admin_amount),
    0,
  );
  const parttimerShare = transactions.reduce(
    (sum, tx) => sum + Number(tx.parttimer_amount),
    0,
  );

  const submitPayout = async () => {
    if (!payTarget || !receiptFile) return;
    setUploading(true);

    const path = `admin-to-parttimer/${payTarget.id}/${receiptFile.name}`;
    const { error: uploadError } = await supabase.storage
      .from("payment-receipts")
      .upload(path, receiptFile, { upsert: true });

    if (uploadError) {
      setUploading(false);
      toast({
        title: "Upload failed",
        description: uploadError.message,
        variant: "destructive",
      });
      return;
    }

    const paidAt = new Date().toISOString();
    const { error: updateError } = await supabase
      .from("transactions")
      .update({
        parttimer_paid_at: paidAt,
        parttimer_receipt_path: path,
        parttimer_receipt_name: receiptFile.name,
      })
      .eq("id", payTarget.id);

    setUploading(false);

    if (updateError) {
      toast({
        title: "Could not record the payout",
        description: updateError.message,
        variant: "destructive",
      });
      return;
    }

    setTransactionLocally(payTarget.id, {
      parttimer_paid_at: paidAt,
      parttimer_receipt_path: path,
      parttimer_receipt_name: receiptFile.name,
    });
    setPayTarget(null);
    setReceiptFile(null);
    toast({
      title: "Part-timer marked as paid",
      description: "The receipt is attached and they will see this as settled.",
    });
  };

  const payout = payTarget
    ? (payTarget.assigned_to ? profiles.get(payTarget.assigned_to) ?? null : null)
    : null;

  return (
    <>
      <PageHeader
        title="Transactions"
        description="Every confirmed payment, with the owner and part-timer split for its service."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Transactions" value={transactions.length} />
        <StatCard label="Gross collected" value={formatCurrency(gross)} />
        <StatCard
          label="Owner share"
          value={formatCurrency(owner)}
          tone="progress"
        />
        <StatCard
          label="Part-timer share"
          value={formatCurrency(parttimerShare)}
          tone="info"
        />
      </div>

      <CardSection
        title="All transactions"
        description="Created the moment you confirm a client's payment."
        contentClassName="p-0"
      >
        {transactions.length === 0 ? (
          <div className="p-5">
            <EmptyState
              icon={<Receipt className="h-6 w-6" />}
              title="No transactions yet"
              description="A transaction is recorded when you confirm payment on a delivered project. The split is worked out from the service there and then."
            />
          </div>
        ) : (
          <div className="overflow-x-auto px-5 pb-5">
            <Table>
              <TableCaption className="sr-only">
                Confirmed payments with their owner and part-timer split
              </TableCaption>
              <TableHeader>
                <TableRow>
                  <TableHead>Date</TableHead>
                  <TableHead>Project</TableHead>
                  <TableHead>Client</TableHead>
                  <TableHead>Part-timer</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Owner</TableHead>
                  <TableHead className="text-right">Part-timer</TableHead>
                  <TableHead>Payout</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {transactions.map((tx) => {
                  const order = orderById.get(tx.order_id);
                  const overdue =
                    !!tx.assigned_to &&
                    !tx.parttimer_paid_at &&
                    Date.now() - new Date(tx.created_at).getTime() > OVERDUE_MS;

                  return (
                    <TableRow key={tx.id}>
                      <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                        {formatDate(tx.created_at)}
                      </TableCell>
                      <TableCell
                        className="max-w-[14rem] truncate font-medium"
                        title={order?.title ?? "—"}
                      >
                        {order?.title ?? "—"}
                      </TableCell>
                      <TableCell
                        className="max-w-[10rem] truncate text-muted-foreground"
                        title={order ? nameFor(order.user_id) : "—"}
                      >
                        {order ? nameFor(order.user_id) : "—"}
                      </TableCell>
                      <TableCell
                        className="max-w-[10rem] truncate text-muted-foreground"
                        title={nameFor(tx.assigned_to)}
                      >
                        {nameFor(tx.assigned_to)}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatCurrency(tx.amount)}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatCurrency(tx.admin_amount)}
                      </TableCell>
                      <TableCell className="tabular text-right">
                        {formatCurrency(tx.parttimer_amount)}
                      </TableCell>
                      <TableCell>
                        <div className="flex flex-wrap items-center gap-2">
                          {!tx.assigned_to ? (
                            <span className="text-sm text-muted-foreground">—</span>
                          ) : tx.parttimer_paid_at ? (
                            <ToneBadge tone="success">Paid</ToneBadge>
                          ) : (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => {
                                setPayTarget(tx);
                                setReceiptFile(null);
                              }}
                            >
                              <Banknote className="h-4 w-4" />
                              Pay part-timer
                            </Button>
                          )}
                          {overdue && <ToneBadge tone="warning">Overdue</ToneBadge>}
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardSection>

      <Dialog
        open={payTarget !== null}
        onOpenChange={(open) => {
          if (!open) {
            setPayTarget(null);
            setReceiptFile(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Pay the part-timer</DialogTitle>
            <DialogDescription>
              {payTarget ? nameFor(payTarget.assigned_to) : "Unknown"}
              {payout?.gcash_number
                ? ` — GCash ${payout.gcash_number}${
                    payout.gcash_name ? ` (${payout.gcash_name})` : ""
                  }`
                : ""}
              . Amount {formatCurrency(payTarget?.parttimer_amount ?? 0)}.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="payout-receipt">Receipt file</Label>
            <Input
              id="payout-receipt"
              type="file"
              accept="image/*,.pdf"
              onChange={(event) =>
                setReceiptFile(event.target.files?.[0] ?? null)
              }
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              Attach the GCash confirmation so the payout is on record.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setPayTarget(null);
                setReceiptFile(null);
              }}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void submitPayout()}
              disabled={!receiptFile || uploading}
            >
              {uploading ? "Uploading…" : "Mark as paid"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
