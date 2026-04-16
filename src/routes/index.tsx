import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useBaby } from "@/lib/baby-context";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Milk, Baby as BabyIcon, History, Loader2, Moon } from "lucide-react";
import { timeAgo, startOfDay, endOfDay } from "@/lib/time";

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
interface SleepRow {
  started_at: string;
  ended_at: string;
}

function formatDuration(ms: number) {
  if (ms <= 0) return "0m";
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
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

  if (authLoading || babyLoading || !user || !activeBaby) {
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
  const [lastSleep, setLastSleep] = useState<SleepRow | null>(null);
  const [todayMl, setTodayMl] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [todaySleepMs, setTodaySleepMs] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeBaby) return;
    let active = true;
    (async () => {
      setLoading(true);
      const dayStart = startOfDay(new Date());
      const dayEnd = endOfDay(new Date());
      const dayStartIso = dayStart.toISOString();
      const dayEndIso = dayEnd.toISOString();

      const [{ data: f }, { data: d }, { data: s }, { data: todayFeeds }, { data: todaySleeps }] =
        await Promise.all([
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
          supabase
            .from("sleeps")
            .select("started_at, ended_at")
            .eq("baby_id", activeBaby.id)
            .order("ended_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("feedings")
            .select("amount, unit")
            .eq("baby_id", activeBaby.id)
            .gte("occurred_at", dayStartIso)
            .lte("occurred_at", dayEndIso),
          supabase
            .from("sleeps")
            .select("started_at, ended_at")
            .eq("baby_id", activeBaby.id)
            .gte("ended_at", dayStartIso)
            .lte("started_at", dayEndIso),
        ]);

      if (!active) return;

      setLastFeed(f as LastFeeding | null);
      setLastDiaper(d as LastDiaper | null);
      setLastSleep(s as SleepRow | null);

      let total = 0;
      const list = (todayFeeds ?? []) as { amount: number; unit: string }[];
      for (const row of list) {
        total += row.unit === "oz" ? Number(row.amount) * 29.5735 : Number(row.amount);
      }
      setTodayMl(Math.round(total));
      setTodayCount(list.length);

      // Sum sleep duration overlapping with today
      const sleepRows = (todaySleeps ?? []) as SleepRow[];
      let sleepMs = 0;
      for (const row of sleepRows) {
        const startMs = Math.max(new Date(row.started_at).getTime(), dayStart.getTime());
        const endMs = Math.min(new Date(row.ended_at).getTime(), dayEnd.getTime());
        if (endMs > startMs) sleepMs += endMs - startMs;
      }
      setTodaySleepMs(sleepMs);

      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [activeBaby]);

  return (
    <div className="min-h-screen pb-12">
      <AppHeader />
      <main className="mx-auto max-w-md px-4 pt-4 space-y-5">
        {/* Today's summary — bordered, color-coded to match actions */}
        <Card className="rounded-3xl p-4 border-2 border-border bg-card shadow-none">
          <div className="grid grid-cols-3 divide-x divide-border">
            <div className="px-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                <Milk className="w-3.5 h-3.5" /> Milk
              </div>
              {loading ? (
                <div className="mx-auto mt-1.5 h-7 w-16 rounded-md bg-foreground/5 animate-pulse" />
              ) : (
                <div className="mt-1 text-2xl font-extrabold text-primary leading-tight">
                  {todayMl}
                  <span className="ml-0.5 text-xs font-bold text-primary/70">ml</span>
                </div>
              )}
              <div className="text-[11px] font-medium text-muted-foreground">
                {todayCount} feed{todayCount === 1 ? "" : "s"}
              </div>
            </div>
            <div className="px-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-diaper-foreground">
                <BabyIcon className="w-3.5 h-3.5" /> Diaper
              </div>
              {loading ? (
                <div className="mx-auto mt-1.5 h-7 w-16 rounded-md bg-foreground/5 animate-pulse" />
              ) : lastDiaper ? (
                <>
                  <div className="mt-1 text-2xl font-extrabold text-diaper-foreground leading-tight capitalize">
                    {lastDiaper.type}
                  </div>
                  <div className="text-[11px] font-medium text-muted-foreground">
                    {timeAgo(lastDiaper.occurred_at)}
                  </div>
                </>
              ) : (
                <div className="mt-1 text-sm font-medium text-muted-foreground">—</div>
              )}
            </div>
            <div className="px-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-sleep-foreground">
                <Moon className="w-3.5 h-3.5" /> Sleep
              </div>
              {loading ? (
                <div className="mx-auto mt-1.5 h-7 w-16 rounded-md bg-foreground/5 animate-pulse" />
              ) : (
                <div className="mt-1 text-2xl font-extrabold text-sleep-foreground leading-tight">
                  {formatDuration(todaySleepMs)}
                </div>
              )}
              <div className="text-[11px] font-medium text-muted-foreground">today</div>
            </div>
          </div>
        </Card>

        {/* CTAs */}
        <div className="grid grid-cols-1 gap-3 pt-1">
          <Button
            asChild
            className="h-20 rounded-full text-xl font-extrabold shadow-md bg-primary hover:bg-primary/90 text-primary-foreground"
          >
            <Link to="/log/feed">
              <Milk className="!w-7 !h-7" /> Eat
            </Link>
          </Button>
          <Button
            asChild
            className="h-20 rounded-full text-xl font-extrabold shadow-md bg-diaper hover:bg-diaper/90 text-diaper-foreground"
          >
            <Link to="/log/diaper">
              <BabyIcon className="!w-7 !h-7" /> Clean
            </Link>
          </Button>
          <Button
            asChild
            className="h-20 rounded-full text-xl font-extrabold shadow-md bg-sleep hover:bg-sleep/90 text-sleep-foreground"
          >
            <Link to="/log/sleep">
              <Moon className="!w-7 !h-7" /> Sleep
            </Link>
          </Button>
        </div>

        <Link
          to="/history"
          className="flex items-center justify-center gap-2 mt-2 py-4 rounded-full bg-card border border-border text-foreground font-bold hover:bg-muted transition-colors"
        >
          <History className="w-5 h-5" /> View history
        </Link>
      </main>
    </div>
  );
}
