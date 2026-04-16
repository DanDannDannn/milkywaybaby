import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useBaby } from "@/lib/baby-context";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Milk, Baby as BabyIcon, History, Loader2 } from "lucide-react";
import { timeAgo } from "@/lib/time";

export const Route = createFileRoute("/")({
  component: HomePage,
});

interface LastFeeding {
  occurred_at: string;
  amount: number;
  unit: string;
  type: string;
}
interface LastDiaper {
  occurred_at: string;
  type: string;
}

function HomePage() {
  const { user, loading: authLoading } = useAuth();
  const { activeBaby, babies, loading: babyLoading } = useBaby();
  const navigate = useNavigate();

  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      navigate({ to: "/auth" });
      return;
    }
    if (!babyLoading && babies.length === 0) {
      navigate({ to: "/onboarding" });
    }
  }, [authLoading, babyLoading, user, babies.length, navigate]);

  if (authLoading || babyLoading || !user) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!activeBaby) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Home />;
}

function Home() {
  const { activeBaby } = useBaby();
  const [lastFeed, setLastFeed] = useState<LastFeeding | null>(null);
  const [lastDiaper, setLastDiaper] = useState<LastDiaper | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeBaby) return;
    let active = true;
    (async () => {
      setLoading(true);
      const [{ data: f }, { data: d }] = await Promise.all([
        supabase
          .from("feedings")
          .select("occurred_at, amount, unit, type")
          .eq("baby_id", activeBaby.id)
          .order("occurred_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("diapers")
          .select("occurred_at, type")
          .eq("baby_id", activeBaby.id)
          .order("occurred_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);
      if (!active) return;
      setLastFeed(f as LastFeeding | null);
      setLastDiaper(d as LastDiaper | null);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [activeBaby]);

  return (
    <div className="min-h-screen pb-10">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 pt-4 space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Card className="rounded-3xl p-4 border-0 bg-feeding/40 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-feeding-foreground/80">
              <Milk className="w-4 h-4" /> Last feed
            </div>
            {loading ? (
              <div className="mt-3 h-10 rounded-md bg-foreground/5 animate-pulse" />
            ) : lastFeed ? (
              <>
                <div className="mt-2 text-lg font-semibold text-foreground">
                  {timeAgo(lastFeed.occurred_at)}
                </div>
                <div className="text-xs text-foreground/70 capitalize">
                  {Number(lastFeed.amount)}
                  {lastFeed.unit} · {lastFeed.type === "breast" ? "breast milk" : "formula"}
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm text-foreground/60">No feeds yet</div>
            )}
          </Card>

          <Card className="rounded-3xl p-4 border-0 bg-diaper/40 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-medium text-diaper-foreground/80">
              <BabyIcon className="w-4 h-4" /> Last diaper
            </div>
            {loading ? (
              <div className="mt-3 h-10 rounded-md bg-foreground/5 animate-pulse" />
            ) : lastDiaper ? (
              <>
                <div className="mt-2 text-lg font-semibold text-foreground">
                  {timeAgo(lastDiaper.occurred_at)}
                </div>
                <div className="text-xs text-foreground/70 capitalize">{lastDiaper.type}</div>
              </>
            ) : (
              <div className="mt-2 text-sm text-foreground/60">No changes yet</div>
            )}
          </Card>
        </div>

        <div className="grid grid-cols-1 gap-3 pt-2">
          <Button
            asChild
            className="h-20 rounded-3xl text-lg font-semibold shadow-md bg-feeding hover:bg-feeding/90 text-feeding-foreground"
          >
            <Link to="/log/feed">
              <Milk className="!w-6 !h-6" /> Log feeding
            </Link>
          </Button>
          <Button
            asChild
            className="h-20 rounded-3xl text-lg font-semibold shadow-md bg-diaper hover:bg-diaper/90 text-diaper-foreground"
          >
            <Link to="/log/diaper">
              <BabyIcon className="!w-6 !h-6" /> Log diaper
            </Link>
          </Button>
        </div>

        <Link
          to="/history"
          className="flex items-center justify-center gap-2 mt-4 py-3 rounded-2xl bg-card border border-border/60 text-foreground hover:bg-muted transition-colors"
        >
          <History className="w-4 h-4" /> View history
        </Link>
      </main>
    </div>
  );
}
