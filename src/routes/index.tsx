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
import babyHero from "@/assets/baby-hero.png";

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
      <main className="mx-auto max-w-md px-4 pt-2 space-y-5">
        {/* Hero illustration + today's summary */}
        <section className="pt-2">
          <div className="flex justify-center">
            <img
              src={babyHero}
              alt=""
              width={160}
              height={160}
              className="w-40 h-40 object-contain select-none pointer-events-none"
            />
          </div>

          <div className="mt-2 grid grid-cols-2 gap-x-6 gap-y-1 text-center">
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Today's milk
              </div>
              {loading ? (
                <div className="mx-auto mt-1 h-7 w-20 rounded-md bg-foreground/5 animate-pulse" />
              ) : (
                <div className="text-2xl font-extrabold text-foreground leading-tight">
                  {todayMl}
                  <span className="ml-0.5 text-sm font-bold text-muted-foreground">ml</span>
                </div>
              )}
              <div className="text-[11px] font-medium text-muted-foreground">
                {todayCount} feed{todayCount === 1 ? "" : "s"}
              </div>
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                Today's sleep
              </div>
              {loading ? (
                <div className="mx-auto mt-1 h-7 w-20 rounded-md bg-foreground/5 animate-pulse" />
              ) : (
                <div className="text-2xl font-extrabold text-foreground leading-tight">
                  {formatDuration(todaySleepMs)}
                </div>
              )}
              <div className="text-[11px] font-medium text-muted-foreground">
                {lastFeed ? `last feed ${timeAgo(lastFeed.occurred_at)}` : "no feeds yet"}
              </div>
            </div>
          </div>
        </section>

        <div className="h-px bg-border/60" />

        {/* Status cards */}
        <div className="grid grid-cols-1 gap-3">
          <Card className="rounded-3xl p-4 border-0 bg-diaper/40 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-diaper-foreground/80">
              <BabyIcon className="w-4 h-4" /> Last diaper
            </div>
            {loading ? (
              <div className="mt-3 h-10 rounded-md bg-foreground/5 animate-pulse" />
            ) : lastDiaper ? (
              <>
                <div className="mt-2 text-lg font-extrabold text-foreground">
                  {timeAgo(lastDiaper.occurred_at)}
                </div>
                <div className="text-xs font-medium text-foreground/70 capitalize">
                  {lastDiaper.type}
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm text-foreground/60">No changes yet</div>
            )}
          </Card>

          {lastSleep && (
            <Card className="rounded-3xl p-4 border-0 bg-sleep/30 shadow-sm">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-sleep-foreground/80">
                <Moon className="w-4 h-4" /> Last sleep
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-2xl font-extrabold text-foreground">
                  {formatDuration(
                    new Date(lastSleep.ended_at).getTime() -
                      new Date(lastSleep.started_at).getTime()
                  )}
                </span>
                <span className="text-sm font-medium text-foreground/60">
                  ended {timeAgo(lastSleep.ended_at)}
                </span>
              </div>
            </Card>
          )}
        </div>

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
