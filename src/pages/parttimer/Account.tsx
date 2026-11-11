import { useCallback, useEffect, useState } from "react";
import { Banknote, Check, LogOut, Pencil, X } from "lucide-react";

import { Button } from "@/components/ui/button";
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
import { ErrorState, PageSkeleton } from "@/components/app/States";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { downloadReceipt } from "@/lib/download";
import { fetchPartTimerRatings } from "@/lib/parttimer-ratings";
import {
  formatCurrency,
  formatDate,
  type Order,
  type Profile,
} from "@/lib/orders";
import type { Tables } from "@/integrations/supabase/types";

type Payment = Tables<"transactions">;

export default function Account() {
  const { user, signOut } = useAuth();

  const [profile, setProfile] = useState<Profile | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [rating, setRating] = useState<{ avg: number; count: number } | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [gcashName, setGcashName] = useState("");
  const [touched, setTouched] = useState(false);

  const load = useCallback(async () => {
    if (!user) return;
    setError(null);
    try {
      const [profileResult, ordersResult, paymentsResult] = await Promise.all([
        supabase.from("profiles").select("*").eq("user_id", user.id).single(),
        supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false }),
        supabase
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false }),
      ]);

      const row = (profileResult.data ?? null) as Profile | null;
      setProfile(row);
      setFullName(row?.full_name ?? "");
      setPhone(row?.phone ?? "");
      setGcashNumber(row?.gcash_number ?? "");
      setGcashName(row?.gcash_name ?? "");

      setOrders((ordersResult.data ?? []) as Order[]);
      setPayments((paymentsResult.data ?? []) as Payment[]);

      const ratings = await fetchPartTimerRatings([user.id]);
      setRating(ratings.get(user.id) ?? null);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "We could not load your account.",
      );
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={() => void load()} />;

  const nameIsValid = fullName.trim().length >= 2;
  const phoneIsValid =
    phone.trim() === "" || /^(\+?63|0)9\d{9}$/.test(phone.trim().replace(/\s/g, ""));

  const mine = orders.filter((order) => order.assigned_to === user?.id);
  const delivered = mine.filter((order) => order.status === "completed");
  const earned = payments
    .filter((payment) => payment.parttimer_paid_at)
    .reduce((sum, payment) => sum + Number(payment.parttimer_amount), 0);
  const awaiting = payments
    .filter((payment) => !payment.parttimer_paid_at)
    .reduce((sum, payment) => sum + Number(payment.parttimer_amount), 0);

  const orderTitle = (orderId: string) =>
    orders.find((order) => order.id === orderId)?.title ?? "—";

  const save = async () => {
    if (!user) return;
    setTouched(true);

    if (!nameIsValid) {
      toast({
        title: "A name is required",
        description: "Enter the name we should use for you.",
        variant: "destructive",
      });
      return;
    }
    if (!phoneIsValid) {
      toast({
        title: "That phone number does not look right",
        description: "Use a Philippine mobile number, for example 09171234567.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const updates = {
      full_name: fullName.trim() || null,
      phone: phone.trim() || null,
      gcash_number: gcashNumber.trim() || null,
      gcash_name: gcashName.trim() || null,
    };

    const { error: saveError } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id);
    setSaving(false);

    if (saveError) {
      toast({
        title: "Could not save your details",
        description: saveError.message,
        variant: "destructive",
      });
      return;
    }

    setProfile((current) =>
      current ? ({ ...current, ...updates } as Profile) : current,
    );
    setEditing(false);
    setTouched(false);
    toast({
      title: "Details saved",
      description: "We will use these for your payouts.",
    });
  };

  return (
    <>
      <PageHeader
        title="Account"
        description="Your details, your payout record, and the feedback clients have left."
      />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Projects delivered" value={delivered.length} />
        <StatCard
          label="Paid out to you"
          value={formatCurrency(earned)}
          tone="success"
        />
        <StatCard
          label="Awaiting payout"
          value={formatCurrency(awaiting)}
          tone={awaiting > 0 ? "warning" : "neutral"}
        />
        <StatCard
          label="Average rating"
          value={rating ? `${rating.avg.toFixed(1)} / 5` : "—"}
          hint={rating ? `${rating.count} reviews` : "No reviews yet"}
          tone={rating ? "info" : "neutral"}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="space-y-6">
          <CardSection
            title="Your details"
            description="Payouts use the GCash details you enter here."
            actions={
              editing ? (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setEditing(false);
                      setTouched(false);
                      setFullName(profile?.full_name ?? "");
                      setPhone(profile?.phone ?? "");
                      setGcashNumber(profile?.gcash_number ?? "");
                      setGcashName(profile?.gcash_name ?? "");
                    }}
                    disabled={saving}
                  >
                    <X className="h-4 w-4" />
                    Cancel
                  </Button>
                  <Button size="sm" onClick={() => void save()} disabled={saving}>
                    <Check className="h-4 w-4" />
                    {saving ? "Saving…" : "Save"}
                  </Button>
                </div>
              ) : (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setEditing(true)}
                >
                  <Pencil className="h-4 w-4" />
                  Edit
                </Button>
              )
            }
          >
            {editing ? (
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="pt-name">Full name</Label>
                  <Input
                    id="pt-name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    aria-invalid={touched && !nameIsValid}
                  />
                  {touched && !nameIsValid && (
                    <p className="text-xs text-destructive">
                      Please enter your name.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pt-email">Email</Label>
                  <Input id="pt-email" value={profile?.email ?? ""} disabled />
                  <p className="text-xs text-muted-foreground">
                    Your sign-in email cannot be changed here.
                  </p>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pt-phone">Phone</Label>
                  <Input
                    id="pt-phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="09171234567"
                    inputMode="tel"
                    aria-invalid={touched && !phoneIsValid}
                  />
                  {touched && !phoneIsValid && (
                    <p className="text-xs text-destructive">
                      Use a Philippine mobile number, for example 09171234567.
                    </p>
                  )}
                </div>
                <div className="space-y-2">
                  <Label htmlFor="pt-gcash">GCash number</Label>
                  <Input
                    id="pt-gcash"
                    value={gcashNumber}
                    onChange={(event) => setGcashNumber(event.target.value)}
                    placeholder="09171234567"
                    inputMode="tel"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="pt-gcash-name">GCash account name</Label>
                  <Input
                    id="pt-gcash-name"
                    value={gcashName}
                    onChange={(event) => setGcashName(event.target.value)}
                  />
                </div>
              </div>
            ) : (
              <dl className="grid gap-5 sm:grid-cols-2">
                <div>
                  <dt className="text-sm text-muted-foreground">Full name</dt>
                  <dd className="mt-1 font-medium text-foreground">
                    {profile?.full_name || "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Email</dt>
                  <dd className="mt-1 truncate font-medium text-foreground">
                    {profile?.email || user?.email || "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">Phone</dt>
                  <dd className="tabular mt-1 font-medium text-foreground">
                    {profile?.phone || "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">GCash number</dt>
                  <dd className="tabular mt-1 font-medium text-foreground">
                    {profile?.gcash_number || "Not set"}
                  </dd>
                </div>
                <div>
                  <dt className="text-sm text-muted-foreground">
                    GCash account name
                  </dt>
                  <dd className="mt-1 font-medium text-foreground">
                    {profile?.gcash_name || "Not set"}
                  </dd>
                </div>
              </dl>
            )}
          </CardSection>

          <CardSection
            title="Payment history"
            description="Every project of yours that has been paid for, and whether your share has been sent."
            contentClassName="p-0"
          >
            {payments.length === 0 ? (
              <p className="p-5 text-sm text-muted-foreground">
                Nothing here yet. A payment appears once we confirm the client has
                paid for work you delivered.
              </p>
            ) : (
              <div className="overflow-x-auto px-5 pb-5">
                <Table>
                  <TableCaption className="sr-only">
                    Your share of each paid project
                  </TableCaption>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Date</TableHead>
                      <TableHead>Project</TableHead>
                      <TableHead className="text-right">Your share</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead className="text-right">Receipt</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {payments.map((payment) => (
                      <TableRow key={payment.id}>
                        <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                          {formatDate(payment.created_at)}
                        </TableCell>
                        <TableCell
                          className="max-w-[18rem] truncate font-medium"
                          title={orderTitle(payment.order_id)}
                        >
                          {orderTitle(payment.order_id)}
                        </TableCell>
                        <TableCell className="tabular text-right font-medium">
                          {formatCurrency(payment.parttimer_amount)}
                        </TableCell>
                        <TableCell>
                          {payment.parttimer_paid_at ? (
                            <ToneBadge tone="success">Sent</ToneBadge>
                          ) : (
                            <ToneBadge tone="warning">Awaiting payout</ToneBadge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          {payment.parttimer_receipt_path ? (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() =>
                                void downloadReceipt(
                                  payment.parttimer_receipt_path!,
                                  payment.parttimer_receipt_name ??
                                    "receipt",
                                )
                              }
                            >
                              <Banknote className="h-4 w-4" />
                              View
                            </Button>
                          ) : (
                            <span className="text-muted-foreground">—</span>
                          )}
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardSection>

          {delivered.length > 0 && (
            <CardSection
              title="Work you have delivered"
              description={`${delivered.length} ${
                delivered.length === 1 ? "project" : "projects"
              } finished.`}
            >
              <ul className="divide-y divide-border/70">
                {delivered.map((order) => (
                  <li
                    key={order.id}
                    className="flex flex-wrap items-center justify-between gap-2 py-3 first:pt-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-foreground">
                        {order.title}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {order.service_type}
                      </p>
                    </div>
                    <span className="tabular shrink-0 text-sm text-muted-foreground">
                      {formatCurrency(order.amount)}
                    </span>
                  </li>
                ))}
              </ul>
            </CardSection>
          )}
        </div>

        <div className="space-y-6">
          <CardSection title="How you are paid">
            <p className="text-sm leading-relaxed text-muted-foreground">
              We confirm each client payment first, then send your share to the
              GCash number on this page. Every transfer shows up in your payment
              history with its receipt attached.
            </p>
            {!profile?.gcash_number && (
              <p className="mt-4 text-sm leading-relaxed text-warning">
                Add your GCash number so we can pay you without delay.
              </p>
            )}
          </CardSection>

          <CardSection title="Session">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Signed in as {user?.email ?? "your account"}.
            </p>
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={() => void signOut()}
            >
              <LogOut className="h-4 w-4" />
              Sign out
            </Button>
          </CardSection>
        </div>
      </div>
    </>
  );
}
