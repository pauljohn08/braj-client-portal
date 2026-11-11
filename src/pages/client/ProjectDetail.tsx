import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileText, Star, Upload } from "lucide-react";

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
import { Textarea } from "@/components/ui/textarea";
import { CardSection } from "@/components/app/CardSection";
import { FileRow } from "@/components/app/FileRow";
import { MilestoneRail } from "@/components/app/MilestoneRail";
import { PageHeader } from "@/components/app/PageHeader";
import { ServiceGlyph } from "@/components/app/ServiceGlyph";
import { StatusBadge, ToneBadge } from "@/components/app/Badges";
import { EmptyState, ErrorState, PageSkeleton } from "@/components/app/States";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useClientData } from "@/hooks/useClientData";
import {
  formatCurrency,
  formatDate,
  formatDateTime,
  getDeadlineInfo,
  getMilestones,
  quoteIsSet,
  statusHint,
} from "@/lib/orders";

const GCASH_NUMBER = "09155090144";
const GCASH_NAME = "Baltazar R. Abobo Jr.";

export default function ProjectDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const {
    orders,
    files,
    receipts,
    ratings,
    uploaderNames,
    outputCounts,
    loading,
    error,
    refresh,
    addReceiptLocally,
    addRatingLocally,
  } = useClientData();

  const [payOpen, setPayOpen] = useState(false);
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);

  const [rateOpen, setRateOpen] = useState(false);
  const [rating, setRating] = useState<number | null>(null);
  const [testimony, setTestimony] = useState("");
  const [savingRating, setSavingRating] = useState(false);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={refresh} />;

  const order = orders.find((item) => item.id === orderId);

  if (!order) {
    return (
      <>
        <PageHeader title="Project not found" />
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title="We could not find that project"
          description="It may have been withdrawn, or the link may be out of date."
          action={
            <Button asChild>
              <Link to="/dashboard/projects">Back to my projects</Link>
            </Button>
          }
        />
      </>
    );
  }

  const orderFiles = files.filter((file) => file.order_id === order.id);
  const inputFiles = orderFiles.filter((file) => file.file_type === "input");
  const outputFiles = orderFiles.filter((file) => file.file_type === "output");
  const receipt = receipts.find((item) => item.order_id === order.id);
  const existingRating = ratings.find((item) => item.order_id === order.id);
  const outputCount = outputCounts.get(order.id) ?? 0;
  const deadline = getDeadlineInfo(order);

  const awaitingPayment = order.status === "completed" && !order.payment_received;
  const canRate = order.status === "completed" && order.payment_received;

  const handleReceiptUpload = async () => {
    if (!user || !receiptFile) return;
    setUploading(true);

    const path = `${order.id}/${receiptFile.name}`;
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

    const { data, error: saveError } = await supabase
      .from("payment_receipts")
      .upsert(
        {
          order_id: order.id,
          file_path: path,
          file_name: receiptFile.name,
        },
        { onConflict: "order_id" },
      )
      .select()
      .single();

    setUploading(false);

    if (saveError) {
      toast({
        title: "Could not save the receipt",
        description: saveError.message,
        variant: "destructive",
      });
      return;
    }

    addReceiptLocally(data);
    setReceiptFile(null);
    setPayOpen(false);
    toast({
      title: "Receipt submitted",
      description: "We will confirm it shortly and unlock your files.",
    });
  };

  const handleRating = async () => {
    setSavingRating(true);
    const { data, error: saveError } = await supabase
      .from("order_ratings")
      .insert({
        order_id: order.id,
        rating,
        testimony: testimony.trim() ? testimony.trim() : null,
      })
      .select()
      .single();

    setSavingRating(false);

    if (saveError) {
      toast({
        title: "Could not save your feedback",
        description: saveError.message,
        variant: "destructive",
      });
      return;
    }

    addRatingLocally(data);
    setRateOpen(false);
    setTestimony("");
    toast({ title: "Thank you", description: "Your feedback has been recorded." });
  };

  return (
    <>
      <div className="mb-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2">
          <Link to="/dashboard/projects">
            <ArrowLeft className="h-4 w-4" />
            All projects
          </Link>
        </Button>
      </div>

      <PageHeader
        title={order.title}
        description={`${order.service_type} — ${order.pricing_tier}`}
        actions={<StatusBadge status={order.status} />}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardSection
            title="Progress"
            description={statusHint(order)}
          >
            <MilestoneRail milestones={getMilestones(order, outputCount)} />
          </CardSection>

          {awaitingPayment && (
            <CardSection
              title="Payment"
              description={
                receipt
                  ? "Your receipt is with us and is being confirmed."
                  : "Your work is delivered. Settle the agreed amount to unlock your files."
              }
            >
              <div className="space-y-5">
                <div className="grid gap-4 sm:grid-cols-3">
                  <div>
                    <p className="text-sm text-muted-foreground">Amount due</p>
                    <p className="tabular mt-1 font-display text-2xl font-semibold text-foreground">
                      {quoteIsSet(order) ? formatCurrency(order.amount) : "—"}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">GCash number</p>
                    <p className="tabular mt-1 font-medium text-foreground">
                      {GCASH_NUMBER}
                    </p>
                  </div>
                  <div>
                    <p className="text-sm text-muted-foreground">GCash name</p>
                    <p className="mt-1 font-medium text-foreground">
                      {GCASH_NAME}
                    </p>
                  </div>
                </div>

                {receipt ? (
                  <div className="rounded-lg border border-border bg-muted/40 p-4">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground">
                          Receipt received
                        </p>
                        <p className="truncate text-sm text-muted-foreground">
                          {receipt.file_name} — {formatDateTime(receipt.created_at)}
                        </p>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => setPayOpen(true)}
                      >
                        Replace receipt
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button onClick={() => setPayOpen(true)}>
                    <Upload className="h-4 w-4" />
                    Upload payment receipt
                  </Button>
                )}
              </div>
            </CardSection>
          )}

          <CardSection
            title="Files"
            description="Everything you sent us and everything we have returned."
          >
            {orderFiles.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No files on this project yet.
              </p>
            ) : (
              <div className="space-y-5">
                <div>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">
                    Delivered to you
                  </h3>
                  {outputFiles.length > 0 ? (
                    <div className="divide-y divide-border/70">
                      {outputFiles.map((file) => (
                        <FileRow
                          key={file.id}
                          file={file}
                          order={order}
                          uploaderName={uploaderNames.get(file.uploaded_by ?? "")}
                        />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      Your finished files will appear here.
                    </p>
                  )}
                </div>

                <div>
                  <h3 className="mb-2 text-sm font-semibold text-foreground">
                    You shared
                  </h3>
                  {inputFiles.length > 0 ? (
                    <div className="divide-y divide-border/70">
                      {inputFiles.map((file) => (
                        <FileRow key={file.id} file={file} order={order} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">
                      No files were attached to this request.
                    </p>
                  )}
                </div>
              </div>
            )}
          </CardSection>

          {canRate && (
            <CardSection
              title="Feedback"
              description="Optional, and it helps the next client decide."
              actions={
                existingRating ? undefined : (
                  <Button variant="outline" size="sm" onClick={() => setRateOpen(true)}>
                    <Star className="h-4 w-4" />
                    Rate this project
                  </Button>
                )
              }
            >
              {existingRating ? (
                <div className="flex items-center gap-3">
                  <ToneBadge tone="warning">
                    {existingRating.rating
                      ? `${existingRating.rating} out of 5`
                      : "Skipped"}
                  </ToneBadge>
                  {existingRating.testimony && (
                    <p className="text-sm italic text-muted-foreground">
                      “{existingRating.testimony}”
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">
                  You have not rated this project yet.
                </p>
              )}
            </CardSection>
          )}
        </div>

        <div className="space-y-6">
          <CardSection title="Request details">
            <dl className="space-y-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Service</dt>
                <dd className="flex items-center gap-2 text-right font-medium text-foreground">
                  <ServiceGlyph
                    serviceName={order.service_type}
                    className="h-4 w-4 text-muted-foreground"
                  />
                  {order.service_type}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Pricing tier</dt>
                <dd className="text-right font-medium text-foreground">
                  {order.pricing_tier}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Agreed amount</dt>
                <dd className="tabular text-right font-medium text-foreground">
                  {quoteIsSet(order) ? formatCurrency(order.amount) : "To be confirmed"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Submitted</dt>
                <dd className="tabular text-right font-medium text-foreground">
                  {formatDate(order.created_at)}
                </dd>
              </div>
              {order.deadline && (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Deadline</dt>
                  <dd className="flex flex-col items-end gap-1">
                    <span className="tabular font-medium text-foreground">
                      {formatDate(order.deadline)}
                    </span>
                    {deadline && (
                      <ToneBadge tone={deadline.tone} dot={false}>
                        {deadline.label}
                      </ToneBadge>
                    )}
                  </dd>
                </div>
              )}
              {order.chapter_count ? (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Chapters</dt>
                  <dd className="tabular text-right font-medium text-foreground">
                    {order.chapter_count}
                  </dd>
                </div>
              ) : null}
              {order.word_count ? (
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Word count</dt>
                  <dd className="tabular text-right font-medium text-foreground">
                    {order.word_count.toLocaleString("en-PH")}
                  </dd>
                </div>
              ) : null}
            </dl>
          </CardSection>

          {order.instructions && (
            <CardSection title="What you asked for">
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-muted-foreground">
                {order.instructions}
              </p>
            </CardSection>
          )}

          <CardSection title="Need something else?">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Send us a new request and we will pick it up from there.
            </p>
            <Button variant="outline" className="mt-4 w-full" asChild>
              <Link to="/order">Submit a request</Link>
            </Button>
          </CardSection>
        </div>
      </div>

      <Dialog
        open={payOpen}
        onOpenChange={(open) => {
          setPayOpen(open);
          if (!open) setReceiptFile(null);
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Upload your payment receipt</DialogTitle>
            <DialogDescription>
              Send {quoteIsSet(order) ? formatCurrency(order.amount) : "the agreed amount"} to{" "}
              {GCASH_NUMBER} ({GCASH_NAME}), then attach the screenshot or PDF
              here.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            <Label htmlFor="receipt">Receipt file</Label>
            <Input
              id="receipt"
              type="file"
              accept="image/*,.pdf"
              onChange={(event) =>
                setReceiptFile(event.target.files?.[0] ?? null)
              }
            />
            <p className="text-xs leading-relaxed text-muted-foreground">
              A screenshot of the GCash confirmation is enough.
            </p>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setPayOpen(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button
              onClick={() => void handleReceiptUpload()}
              disabled={!receiptFile || uploading}
            >
              {uploading ? "Uploading…" : "Submit receipt"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={rateOpen} onOpenChange={setRateOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>How did we do?</DialogTitle>
            <DialogDescription>
              Your rating is optional. You can also leave a short comment we may
              show to other clients.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-5">
            <div className="space-y-2">
              <Label>Rating</Label>
              <div className="flex flex-wrap gap-2">
                {[1, 2, 3, 4, 5].map((value) => (
                  <Button
                    key={value}
                    type="button"
                    variant={rating === value ? "default" : "outline"}
                    size="sm"
                    aria-pressed={rating === value}
                    onClick={() => setRating(value)}
                  >
                    {value}
                  </Button>
                ))}
                <Button
                  type="button"
                  variant={rating === null ? "default" : "outline"}
                  size="sm"
                  aria-pressed={rating === null}
                  onClick={() => setRating(null)}
                >
                  Skip
                </Button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="testimony">Comment</Label>
              <Textarea
                id="testimony"
                value={testimony}
                onChange={(event) => setTestimony(event.target.value)}
                placeholder="Anything you would like to add"
                rows={4}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setRateOpen(false)}
              disabled={savingRating}
            >
              Cancel
            </Button>
            <Button onClick={() => void handleRating()} disabled={savingRating}>
              {savingRating ? "Saving…" : "Submit feedback"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
