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
import { useAdminData } from "@/hooks/useAdminData";

export default function Account() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const { profiles, loading, error, refresh } = useAdminData();

  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");

  const profile = user ? (profiles.get(user.id) ?? null) : null;
  const email = profile?.email || user?.email || "";

  const startEditing = () => {
    setFullName(profile?.full_name ?? "");
    setPhone(profile?.phone ?? "");
    setEditing(true);
  };

  if (loading) return <PageSkeleton />;
  if (error) return <ErrorState onRetry={refresh} />;

  const handleSave = async () => {
    if (!user) return;
    if (!fullName.trim()) {
      toast({
        title: "Full name is required",
        variant: "destructive",
      });
      return;
    }

    setSaving(true);
    const { error: saveError } = await supabase
      .from("profiles")
      .update({ full_name: fullName.trim(), phone: phone.trim() || null })
      .eq("user_id", user.id);
    setSaving(false);

    if (saveError) {
      toast({
        title: "Could not save your profile",
        description: saveError.message,
        variant: "destructive",
      });
      return;
    }

    await refresh();
    setEditing(false);
    toast({ title: "Profile updated" });
  };

  return (
    <>
      <PageHeader
        title="Settings"
        description="Your administrator profile. Clients never see these details."
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <CardSection
            title="Profile"
            description="Used on documents and wherever we sign off on your behalf."
            actions={
              editing ? undefined : (
                <Button variant="outline" size="sm" onClick={startEditing}>
                  Edit profile
                </Button>
              )
            }
          >
            {editing ? (
              <div className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="admin-name">Full name</Label>
                  <Input
                    id="admin-name"
                    value={fullName}
                    onChange={(event) => setFullName(event.target.value)}
                    placeholder="Baltazar R. Abobo Jr."
                    autoComplete="name"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-email">Email</Label>
                  <Input id="admin-email" value={email} disabled readOnly />
                  <p className="text-xs leading-relaxed text-muted-foreground">
                    This is your sign-in address and cannot be changed here.
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="admin-phone">Phone number</Label>
                  <Input
                    id="admin-phone"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="09171234567"
                    inputMode="tel"
                    autoComplete="tel"
                  />
                  <p className="text-xs text-muted-foreground">Optional.</p>
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
                  <dt className="text-muted-foreground">Role</dt>
                  <dd className="text-right font-medium text-foreground">
                    Administrator
                  </dd>
                </div>
              </dl>
            )}
          </CardSection>
        </div>

        <CardSection title="Session">
          <p className="text-sm leading-relaxed text-muted-foreground">
            Signing out ends this session on this device. Nothing in the console
            changes.
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
    </>
  );
}
