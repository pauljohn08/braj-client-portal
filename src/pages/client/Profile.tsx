import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { CardSection } from "@/components/app/CardSection";
import { PageHeader } from "@/components/app/PageHeader";
import { ErrorState, PageSkeleton } from "@/components/app/States";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { useClientData } from "@/hooks/useClientData";
import { formatDate } from "@/lib/orders";

const PH_MOBILE = /^(\+?63|0)9\d{9}$/;

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { orders, profile, loading, error, refresh } = useClientData();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [gcashNumber, setGcashNumber] = useState("");
  const [gcashName, setGcashName] = useState("");

  const startEditing = () => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    setGcashNumber(profile?.gcash_number ?? "");
    setGcashName(profile?.gcash_name ?? "");
    setEditing(true);
  };

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={refresh} />;

  const email = profile?.email || user?.email || "";
  const earliest = [...orders].sort(
    (a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
  )[0];

  const handleSave = async () => {
    if (!user) return;

    if (!fullName.trim()) {
      toast({
        title: "Full name is required",
        description: "Please tell us what to call you.",
        variant: "destructive",
      });
      return;
    }
    if (phone.trim() && !PH_MOBILE.test(phone.trim())) {
      toast({
        title: "That phone number does not look right",
        description: "Use a Philippine mobile number, for example 09171234567.",
        variant: "destructive",
      });
      return;
    }
    if (gcashNumber.trim() && !PH_MOBILE.test(gcashNumber.trim())) {
      toast({
        title: "That GCash number does not look right",
        description: "Use a Philippine mobile number, for example 09171234567.",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const { error: saveError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName.trim(),
        phone: phone.trim() || null,
        gcash_number: gcashNumber.trim() || null,
        gcash_name: gcashName.trim() || null,
      })
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

    await refresh();
    setEditing(false);
    toast({ title: "Details updated" });
  };

  return (
    <>
      <PageHeader
        title="Profile and settings"
        description="Keep your contact details and GCash information up to date so we can reach you and refund quickly."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <CardSection
            title="Your details"
            description="These are what we use to identify you and to match payments."
            actions={
              editing ? undefined : (
                <Button variant="outline" size="sm" onClick={startEditing}>
                  Edit details
                </Button>
              )
            }
          >
            {editing ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="full-name">Full name</Label>
                  <Input
                    id="full-name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Juan Dela Cruz"
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email">Email</Label>
                  <Input id="email" value={email} disabled readOnly />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    Email is your sign-in address and is managed by BRAJ. Ask us
                    if it needs to change.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone number</Label>
                  <Input
                    id="phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="09171234567"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                  <p className="text-xs text-muted-foreground">Optional.</p>
                </div>

                <div className="grid gap-5 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="gcash-number">GCash number</Label>
                    <Input
                      id="gcash-number"
                      value={gcashNumber}
                      onChange={(event) => setGcashNumber(event.target.value)}
                      placeholder="09171234567"
                      inputMode="tel"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="gcash-name">GCash account name</Label>
                    <Input
                      id="gcash-name"
                      value={gcashName}
                      onChange={(event) => setGcashName(event.target.value)}
                      placeholder="Juan Dela Cruz"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button onClick={() => void handleSave()} disabled={saving}>
                    {saving ? "Saving…" : "Save changes"}
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => setEditing(false)}
                    disabled={saving}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            ) : (
              <dl className="space-y-4 text-sm">
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Full name</dt>
                  <dd className="text-right font-medium text-foreground">
                    {profile?.full_name || "—"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Email</dt>
                  <dd className="truncate text-right font-medium text-foreground">
                    {email || "—"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">Phone number</dt>
                  <dd className="tabular text-right font-medium text-foreground">
                    {profile?.phone || "—"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">GCash number</dt>
                  <dd className="tabular text-right font-medium text-foreground">
                    {profile?.gcash_number || "—"}
                  </dd>
                </div>
                <div className="flex items-start justify-between gap-3">
                  <dt className="text-muted-foreground">GCash name</dt>
                  <dd className="text-right font-medium text-foreground">
                    {profile?.gcash_name || "—"}
                  </dd>
                </div>
              </dl>
            )}
          </CardSection>
        </div>

        <div className="space-y-6">
          <CardSection title="Account">
            <dl className="space-y-4 text-sm">
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Projects</dt>
                <dd className="tabular text-right font-medium text-foreground">
                  {orders.length}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Client since</dt>
                <dd className="tabular text-right font-medium text-foreground">
                  {earliest ? formatDate(earliest.created_at) : "—"}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-3">
                <dt className="text-muted-foreground">Reference</dt>
                <dd className="truncate text-right font-mono text-xs text-muted-foreground">
                  {user?.id ?? "—"}
                </dd>
              </div>
            </dl>
          </CardSection>

          <CardSection title="Session">
            <p className="text-sm leading-relaxed text-muted-foreground">
              Signing out ends this session on this device only. Your projects
              stay exactly as they are.
            </p>
            <Button
              variant="outline"
              className="mt-4 w-full"
              onClick={async () => {
                await signOut();
                navigate("/");
              }}
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
