import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Header } from "@/components/Header";
import { useAuth } from "@/hooks/useAuth";
import { Clock } from "lucide-react";

export default function PendingPartTimer() {
  const { signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Header />
      <div className="flex flex-1 items-center justify-center py-12 px-4">
        <Card className="w-full max-w-md shadow-card">
          <CardHeader className="text-center pt-8">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-amber-100">
              <Clock className="h-9 w-9 text-amber-500" />
            </div>
            <CardTitle>Part-timer application pending</CardTitle>
            <CardDescription>
              Your account is waiting for admin approval. You will be able to access the part-timer dashboard and accept orders once an admin confirms your account.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground text-center">
              Please check back later or contact the administrator if this takes longer than expected.
            </p>
            <Button variant="outline" className="w-full" onClick={() => signOut()}>
              Sign out
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
