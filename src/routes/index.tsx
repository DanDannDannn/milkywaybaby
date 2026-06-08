import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useBaby } from "@/lib/baby-context";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Milk, Baby as BabyIcon, History, Loader2, Moon, Thermometer, Plus } from "lucide-react";
import { startOfDay, endOfDay, addDays, fmtTime, timeAgo } from "@/lib/time";

interface LastEvent {
  occurred_at: string;
  label: string;
}

export const Route = createFileRoute("/")({
  component: HomePage,
});

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

const DAYS = 7;

function Home() {
  const { activeBaby } = useBaby();
  const [avgMl, setAvgMl] = useState(0);
  const [avgFeeds, setAvgFeeds] = useState(0);
  const [avgDiapers, setAvgDiapers] = useState(0);
  const [avgSleepMs, setAvgSleepMs] = useState(0);
  const [avgTemp, setAvgTemp] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeBaby) return;
    let active = true;
    (async () => {
      setLoading(true);
      const today = new Date();
      const rangeStart = startOfDay(addDays(today, -(DAYS - 1)));
      const rangeEnd = endOfDay(today);
      const startIso = rangeStart.toISOString();
      const endIso = rangeEnd.toISOString();

      const [{ data: feeds }, { data: diapers }, { data: sleeps }, { data: temps }] =
        await Promise.all([
          supabase
            .from("feedings")
            .select("amount, unit")
            .eq("baby_id", activeBaby.id)
            .gte("occurred_at", startIso)
            .lte("occurred_at", endIso),
          supabase
            .from("diapers")
            .select("id")
            .eq("baby_id", activeBaby.id)
            .gte("occurred_at", startIso)
            .lte("occurred_at", endIso),
          supabase
            .from("sleeps")
            .select("started_at, ended_at")
            .eq("baby_id", activeBaby.id)
            .gte("ended_at", startIso)
            .lte("started_at", endIso),
          supabase
            .from("temperatures")
            .select("value_c")
            .eq("baby_id", activeBaby.id)
            .gte("occurred_at", startIso)
            .lte("occurred_at", endIso),
        ]);

      if (!active) return;

      const feedList = (feeds ?? []) as { amount: number | null; unit: string }[];
      let totalMl = 0;
      for (const row of feedList) {
        if (row.amount === null || row.amount === undefined) continue;
        totalMl += row.unit === "oz" ? Number(row.amount) * 29.5735 : Number(row.amount);
      }
      setAvgMl(Math.round(totalMl / DAYS));
      setAvgFeeds(Math.round((feedList.length / DAYS) * 10) / 10);

      setAvgDiapers(Math.round(((diapers ?? []).length / DAYS) * 10) / 10);

      let sleepMs = 0;
      for (const row of (sleeps ?? []) as SleepRow[]) {
        const s = Math.max(new Date(row.started_at).getTime(), rangeStart.getTime());
        const e = Math.min(new Date(row.ended_at).getTime(), rangeEnd.getTime());
        if (e > s) sleepMs += e - s;
      }
      setAvgSleepMs(sleepMs / DAYS);

      const tempList = (temps ?? []) as { value_c: number }[];
      if (tempList.length > 0) {
        const sum = tempList.reduce((acc, t) => acc + Number(t.value_c), 0);
        setAvgTemp(sum / tempList.length);
      } else {
        setAvgTemp(null);
      }

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
        {/* 7-day average summary */}
        <Card className="rounded-3xl p-4 border-2 border-border bg-card shadow-none">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center mb-2">
            7-day average / day
          </div>
          <div className="grid grid-cols-3 divide-x divide-border">
            <div className="px-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-primary">
                <Milk className="w-3.5 h-3.5" /> Milk
              </div>
              {loading ? (
                <div className="mx-auto mt-1.5 h-7 w-16 rounded-md bg-foreground/5 animate-pulse" />
              ) : (
                <div className="mt-1 text-2xl font-extrabold text-primary leading-tight">
                  {avgMl}
                  <span className="ml-0.5 text-xs font-bold text-primary/70">ml</span>
                </div>
              )}
              <div className="text-[11px] font-medium text-muted-foreground">
                {avgFeeds} feed{avgFeeds === 1 ? "" : "s"}
              </div>
            </div>
            <div className="px-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-diaper-foreground">
                <BabyIcon className="w-3.5 h-3.5" /> Diaper
              </div>
              {loading ? (
                <div className="mx-auto mt-1.5 h-7 w-16 rounded-md bg-foreground/5 animate-pulse" />
              ) : (
                <div className="mt-1 text-2xl font-extrabold text-diaper-foreground leading-tight">
                  {avgDiapers}
                </div>
              )}
              <div className="text-[11px] font-medium text-muted-foreground">per day</div>
            </div>
            <div className="px-2 text-center">
              <div className="flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest text-sleep-foreground">
                <Moon className="w-3.5 h-3.5" /> Sleep
              </div>
              {loading ? (
                <div className="mx-auto mt-1.5 h-7 w-16 rounded-md bg-foreground/5 animate-pulse" />
              ) : (
                <div className="mt-1 text-2xl font-extrabold text-sleep-foreground leading-tight">
                  {formatDuration(avgSleepMs)}
                </div>
              )}
              <div className="text-[11px] font-medium text-muted-foreground">per day</div>
            </div>
          </div>
          <div className="mt-3 pt-3 border-t border-border flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-full bg-temperature/30 grid place-items-center shrink-0">
                <Thermometer className="w-4 h-4 text-temperature-foreground" />
              </div>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-widest text-temperature-foreground">
                  Temperature
                </div>
                {loading ? (
                  <div className="mt-1 h-4 w-20 rounded-md bg-foreground/5 animate-pulse" />
                ) : avgTemp !== null ? (
                  <div className="text-sm font-extrabold text-foreground leading-tight">
                    {avgTemp.toFixed(1)}°C
                    <span className="ml-1 text-[11px] font-medium text-muted-foreground">
                      · 7-day avg
                    </span>
                  </div>
                ) : (
                  <div className="text-sm font-medium text-muted-foreground">No readings</div>
                )}
              </div>
            </div>
            <Button
              asChild
              size="sm"
              variant="outline"
              className="rounded-full h-8 px-3 text-xs font-bold border-2 border-temperature/60 text-temperature-foreground hover:bg-temperature/20 shrink-0"
            >
              <Link to="/log/temp">
                <Plus className="!w-3.5 !h-3.5" /> Log
              </Link>
            </Button>
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
