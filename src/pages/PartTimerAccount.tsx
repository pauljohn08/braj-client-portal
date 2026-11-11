import { useEffect, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Header } from "@/components/Header";
import { Footer } from "@/components/Footer";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { fetchPartTimerRatings } from "@/lib/parttimer-ratings";
import { toast } from "@/hooks/use-toast";
import { Loader2, ArrowLeft, User, Banknote, History, CheckCircle, Check, Mail, Phone, CreditCard, Star } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type OrderWithProfile = Tables<"orders"> & { profiles?: { full_name: string; email: string } | null };
type ProfileRow = Tables<"profiles">;

export default function PartTimerAccount() {
  const { user, isPartTimer, isPendingPartTimer, isLoading } = useAuth();
  const navigate = useNavigate();
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [orders, setOrders] = useState<OrderWithProfile[]>([]);
  const [payments, setPayments] = useState<Tables<"transactions">[]>([]);
  const [rating, setRating] = useState<{ avg: number; count: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingProfile, setEditingProfile] = useState(false);
  const [savingProfile, setSavingProfile] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editPhone, setEditPhone] = useState("");
  const [editGcashNumber, setEditGcashNumber] = useState("");
  const [editGcashName, setEditGcashName] = useState("");

  useEffect(() => {
    if (!isLoading && !user) navigate("/auth");
    else if (!isLoading && user && isPendingPartTimer) navigate("/pending-parttimer");
    else if (!isLoading && user && !isPartTimer) navigate("/auth");
  }, [user, isPartTimer, isPendingPartTimer, isLoading, navigate]);

  useEffect(() => {
    if (!user || !isPartTimer) return;
    const fetchData = async () => {
      try {
        const { data: profileData } = await supabase
          .from("profiles")
          .select("*")
          .eq("user_id", user.id)
          .single();
        setProfile(profileData || null);
        setEditFullName(profileData?.full_name || "");
        setEditPhone(profileData?.phone || "");
        setEditGcashNumber(profileData?.gcash_number || "");
        setEditGcashName(profileData?.gcash_name || "");

        const { data: ordersData } = await supabase
          .from("orders")
          .select("*")
          .order("created_at", { ascending: false });
        if (ordersData?.length) {
          const userIds = [...new Set(ordersData.map((o) => o.user_id))];
          const { data: profilesData } = await supabase
            .from("profiles")
            .select("user_id, full_name, email")
            .in("user_id", userIds);
          const profileMap = new Map(profilesData?.map((p) => [p.user_id, p]) || []);
          setOrders(
            ordersData.map((o) => ({
              ...o,
              profiles: profileMap.get(o.user_id) || null,
            }))
          );
        } else {
          setOrders([]);
        }

        const { data: txData } = await supabase
          .from("transactions")
          .select("*")
          .order("created_at", { ascending: false });
        setPayments(txData || []);
        const ratings = await fetchPartTimerRatings([user.id]);
        const r = ratings.get(user.id);
        setRating(r ?? null);
      } catch {
        setProfile(null);
        setOrders([]);
        setPayments([]);
        setRating(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [user, isPartTimer]);

  const handleSaveProfile = async () => {
    if (!user) return;
    setSavingProfile(true);
    const updates = {
      full_name: editFullName.trim() || null,
      phone: editPhone.trim() || null,
      gcash_number: editGcashNumber.trim() || null,
      gcash_name: editGcashName.trim() || null,
    };
    const { error } = await supabase
      .from("profiles")
      .update(updates)
      .eq("user_id", user.id);
    setSavingProfile(false);
    if (error) {
      toast({ title: "Error", description: error.message, variant: "destructive" });
      return;
    }
    setProfile((prev) =>
      prev
        ? { ...prev, ...updates }
        : ({
            email: user.email ?? "",
            user_id: user.id,
            id: "",
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
            gcash_name: updates.gcash_name,
            gcash_number: updates.gcash_number,
            full_name: updates.full_name ?? "",
            phone: updates.phone,
          } as ProfileRow)
    );
    setEditingProfile(false);
    toast({ title: "Profile updated" });
  };

  const completedByMe = orders.filter((o) => o.status === "completed" && o.assigned_to === user?.id);

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
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                <User className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-bold">Account</h1>
                <p className="text-sm text-muted-foreground">Manage your profile and view payment history.</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild className="w-full sm:w-auto">
              <Link to="/parttimer"><ArrowLeft className="h-4 w-4 mr-1" /> Back to Dashboard</Link>
            </Button>
          </div>

          {/* Account details */}
          <div className="mb-10">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <User className="h-5 w-5" />
              Account details
            </h2>
            <Card className="overflow-hidden">
              <CardHeader className="border-b bg-muted/30 items-start gap-2">
                <div>
                  <CardTitle className="text-base font-semibold">Profile</CardTitle>
                  <CardDescription>Your part-timer account information</CardDescription>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    if (!editingProfile && profile) {
                      setEditFullName(profile.full_name || "");
                      setEditPhone(profile.phone || "");
                      setEditGcashNumber(profile.gcash_number || "");
                      setEditGcashName(profile.gcash_name || "");
                    }
                    setEditingProfile((prev) => !prev);
                  }}
                >
                  {editingProfile ? "Cancel" : "Edit"}
                </Button>
              </CardHeader>
              <CardContent className="p-0">
                {editingProfile ? (
                  <form
                    className="space-y-4 px-6 py-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      if (!savingProfile) handleSaveProfile();
                    }}
                  >
                    <div className="space-y-2">
                      <Label htmlFor="pt-full-name">Complete name</Label>
                      <Input
                        id="pt-full-name"
                        value={editFullName}
                        onChange={(e) => setEditFullName(e.target.value)}
                        required
                      />
                      {rating && (
                        <p className="text-xs text-muted-foreground flex items-center gap-1">
                          <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
                          Current rating: {rating.avg} ({rating.count} ratings)
                        </p>
                      )}
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pt-email">Email</Label>
                      <Input
                        id="pt-email"
                        value={profile?.email || user?.email || ""}
                        disabled
                      />
                      <p className="text-xs text-muted-foreground">
                        Email is managed by the administrator and cannot be changed here.
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pt-phone">Phone number (optional)</Label>
                      <Input
                        id="pt-phone"
                        type="tel"
                        value={editPhone}
                        onChange={(e) => setEditPhone(e.target.value)}
                        placeholder="e.g. 09171234567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pt-gcash-number">GCash number</Label>
                      <Input
                        id="pt-gcash-number"
                        type="tel"
                        value={editGcashNumber}
                        onChange={(e) => setEditGcashNumber(e.target.value)}
                        placeholder="e.g. 09171234567"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="pt-gcash-name">GCash name</Label>
                      <Input
                        id="pt-gcash-name"
                        value={editGcashName}
                        onChange={(e) => setEditGcashName(e.target.value)}
                        placeholder="Name on GCash account"
                      />
                    </div>
                    <div className="flex justify-end gap-2 pt-2">
                      <Button
                        type="button"
                        variant="ghost"
                        onClick={() => {
                          if (profile) {
                            setEditFullName(profile.full_name || "");
                            setEditPhone(profile.phone || "");
                            setEditGcashNumber(profile.gcash_number || "");
                            setEditGcashName(profile.gcash_name || "");
                          }
                          setEditingProfile(false);
                        }}
                      >
                        Cancel
                      </Button>
                      <Button type="submit" disabled={savingProfile}>
                        {savingProfile ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : null}
                        Save changes
                      </Button>
                    </div>
                  </form>
                ) : (
                  <dl className="divide-y">
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-6 py-4">
                      <dt className="text-sm font-medium text-muted-foreground min-w-[140px] flex items-center gap-2">
                        <User className="h-4 w-4 shrink-0" />
                        Complete name
                      </dt>
                      <dd className="text-sm font-medium flex items-center gap-2">
                        {profile?.full_name || "—"}
                        {rating && (
                          <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-normal">
                            <Star className="h-4 w-4 fill-amber-500" /> {rating.avg} ({rating.count} ratings)
                          </span>
                        )}
                      </dd>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-6 py-4">
                      <dt className="text-sm font-medium text-muted-foreground min-w-[140px] flex items-center gap-2">
                        <Mail className="h-4 w-4 shrink-0" />
                        Email
                      </dt>
                      <dd className="text-sm">{profile?.email || user?.email || "—"}</dd>
                    </div>
                    <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-6 py-4">
                      <dt className="text-sm font-medium text-muted-foreground min-w-[140px] flex items-center gap-2">
                        <Phone className="h-4 w-4 shrink-0" />
                        Phone number
                      </dt>
                      <dd className="text-sm">{profile?.phone || "—"}</dd>
                    </div>
                    {(profile?.gcash_number || profile?.gcash_name) ? (
                      <>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-6 py-4">
                          <dt className="text-sm font-medium text-muted-foreground min-w-[140px] flex items-center gap-2">
                            <Phone className="h-4 w-4 shrink-0" />
                            GCash number
                          </dt>
                          <dd className="text-sm font-mono tracking-wide">{profile?.gcash_number || "—"}</dd>
                        </div>
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4 px-6 py-4">
                          <dt className="text-sm font-medium text-muted-foreground min-w-[140px] flex items-center gap-2">
                            <CreditCard className="h-4 w-4 shrink-0" />
                            GCash name
                          </dt>
                          <dd className="text-sm">{profile?.gcash_name || "—"}</dd>
                        </div>
                      </>
                    ) : (
                      <div className="px-6 py-4">
                        <p className="text-sm text-muted-foreground flex items-center gap-2">
                          <CreditCard className="h-4 w-4 shrink-0" />
                          GCash details not on file.
                        </p>
                      </div>
                    )}
                  </dl>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Payment history */}
          <div className="mb-10">
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <Banknote className="h-5 w-5" />
              Payment history
            </h2>
            <p className="text-sm text-muted-foreground mb-4">Your share from confirmed payments (admin pays you this amount).</p>
            {payments.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <Banknote className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No payments yet.</p>
                  <p className="text-xs mt-1">Payments appear here after the admin confirms client payment for orders you completed.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="overflow-x-auto -mx-4 sm:mx-0">
                    <div className="inline-block min-w-full align-middle px-4 sm:px-0">
                      <table className="w-full text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b bg-muted/50">
                            <th className="text-left py-2 px-2 sm:px-3 whitespace-nowrap">Date</th>
                            <th className="text-left py-2 px-2 sm:px-3">Order</th>
                            <th className="text-right py-2 px-2 sm:px-3 whitespace-nowrap">Order total</th>
                            <th className="text-right py-2 px-2 sm:px-3 font-medium whitespace-nowrap">Your share</th>
                            <th className="text-center py-2 px-2 sm:px-3 whitespace-nowrap">Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {payments.map((t) => (
                            <tr key={t.id} className="border-b last:border-0">
                              <td className="py-2 px-2 sm:px-3 whitespace-nowrap">{new Date(t.created_at).toLocaleDateString()}</td>
                              <td className="py-2 px-2 sm:px-3 max-w-[150px] truncate" title={orders.find((o) => o.id === t.order_id)?.title ?? "—"}>{orders.find((o) => o.id === t.order_id)?.title ?? "—"}</td>
                              <td className="text-right py-2 px-2 sm:px-3 whitespace-nowrap">₱{Number(t.amount).toLocaleString()}</td>
                              <td className="text-right py-2 px-2 sm:px-3 font-medium text-green-700 whitespace-nowrap">₱{Number(t.parttimer_amount).toLocaleString()}</td>
                              <td className="text-center py-2 px-2 sm:px-3">
                                {t.parttimer_paid_at ? (
                                  <Badge variant="outline" className="text-green-700 border-green-300 text-xs">
                                    <Check className="h-3 w-3 mr-1" /> <span className="hidden sm:inline">Paid by admin</span><span className="sm:hidden">Paid</span>
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground text-xs">Pending</span>
                                )}
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
          </div>

          {/* Completed order history */}
          <div>
            <h2 className="text-lg font-semibold mb-3 flex items-center gap-2">
              <History className="h-5 w-5" />
              Completed order history
            </h2>
            <p className="text-sm text-muted-foreground mb-4">Orders you completed (payment status shown).</p>
            {completedByMe.length === 0 ? (
              <Card>
                <CardContent className="py-8 text-center text-muted-foreground">
                  <History className="h-10 w-10 mx-auto mb-3 opacity-40" />
                  <p>No completed orders yet.</p>
                </CardContent>
              </Card>
            ) : (
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y">
                    {completedByMe.map((order) => (
                      <div
                        key={order.id}
                        className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 hover:bg-muted/40 transition-colors"
                      >
                        <div className="min-w-0">
                          <p className="font-medium truncate">{order.title}</p>
                          <p className="text-sm text-muted-foreground">
                            {order.service_type} — {order.profiles?.full_name || order.profiles?.email || "Unknown"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Completed {new Date(order.updated_at).toLocaleDateString()}
                          </p>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          {order.payment_received ? (
                            <Badge variant="outline" className="text-green-700 border-green-300">
                              <CheckCircle className="h-3 w-3 mr-1" /> Paid
                            </Badge>
                          ) : (
                            <Badge variant="secondary">Awaiting payment</Badge>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </main>
      <Footer />
    </div>
  );
}
