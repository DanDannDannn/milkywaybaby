import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useBaby } from "@/lib/baby-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ChevronLeft, Copy, Loader2 } from "lucide-react";
import { toast } from "sonner";

export const Route = createFileRoute("/baby-settings")({
  head: () => ({ meta: [{ title: "Baby settings — Little Logs" }] }),
  component: BabySettings,
});

function BabySettings() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeBaby, loading } = useBaby();
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  if (authLoading || loading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeBaby) {
    return (
      <div className="min-h-screen grid place-items-center text-muted-foreground">
        No baby selected
      </div>
    );
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(activeBaby.invite_code);
      setCopied(true);
      toast.success("Invite code copied");
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error("Could not copy");
    }
  };

  return (
    <div className="min-h-screen pb-10 bg-background">
      <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b border-border/40">
        <div className="mx-auto max-w-md px-2 h-14 flex items-center gap-2">
          <Link
            to="/"
            className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted text-foreground"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="font-semibold">Baby settings</div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-4 space-y-4">
        <Card className="rounded-3xl p-5 border-0 shadow-sm space-y-1">
          <div className="text-xs uppercase tracking-wider text-muted-foreground">Name</div>
          <div className="text-lg font-semibold text-foreground">{activeBaby.name}</div>
          {activeBaby.birth_date && (
            <div className="text-sm text-muted-foreground">
              Born {new Date(activeBaby.birth_date).toLocaleDateString()}
            </div>
          )}
        </Card>

        <Card className="rounded-3xl p-5 border-0 shadow-sm space-y-3">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Invite code
            </div>
            <div className="mt-2 text-3xl font-mono tracking-[0.4em] font-bold text-foreground text-center py-3 rounded-2xl bg-muted">
              {activeBaby.invite_code}
            </div>
            <p className="mt-2 text-xs text-muted-foreground text-center">
              Share this code with another caregiver. They can enter it from the "Add or join
              baby" screen.
            </p>
          </div>
          <Button onClick={copy} className="w-full h-11 rounded-xl">
            <Copy className="w-4 h-4" /> {copied ? "Copied!" : "Copy code"}
          </Button>
        </Card>
      </main>
    </div>
  );
}
