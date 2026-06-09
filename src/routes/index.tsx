import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useBaby } from "@/lib/baby-context";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Milk, Baby as BabyIcon, History, Loader2, Moon, Thermometer, Plus } from "lucide-react";
import { startOfDay, endOfDay, fmtTime, timeAgo } from "@/lib/time";

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

function Home() {
  const { activeBaby } = useBaby();
  const [totalMl, setTotalMl] = useState(0);
  const [totalFeeds, setTotalFeeds] = useState(0);
  const [totalDiapers, setTotalDiapers] = useState(0);
  const [totalSleepMs, setTotalSleepMs] = useState(0);
  const [lastTemp, setLastTemp] = useState<{ occurred_at: string; value_c: number } | null>(null);
  const [lastFeedAt, setLastFeedAt] = useState<string | null>(null);
  const [lastDiaperAt, setLastDiaperAt] = useState<string | null>(null);
  const [lastWakeAt, setLastWakeAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeBaby) return;
    let active = true;
    (async () => {
      setLoading(true);
      const now = new Date();
      const dayStart = startOfDay(now);
      const dayEnd = endOfDay(now);
      const dayStartIso = dayStart.toISOString();
      const dayEndIso = dayEnd.toISOString();

      const [
        { data: feeds },
        { data: diapers },
        { data: sleeps },
        { data: lf },
        { data: ld },
        { data: ls },
        { data: lt },
      ] = await Promise.all([
        supabase
          .from("feedings")
          .select("amount, unit")
          .eq("baby_id", activeBaby.id)
          .gte("occurred_at", dayStartIso)
          .lte("occurred_at", dayEndIso),
        supabase
          .from("diapers")
          .select("id")
          .eq("baby_id", activeBaby.id)
          .gte("occurred_at", dayStartIso)
          .lte("occurred_at", dayEndIso),
        supabase
          .from("sleeps")
          .select("started_at, ended_at")
          .eq("baby_id", activeBaby.id)
          .gte("ended_at", dayStartIso)
          .lte("started_at", dayEndIso),
        supabase
          .from("feedings")
          .select("occurred_at")
          .eq("baby_id", activeBaby.id)
          .order("occurred_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("diapers")
          .select("occurred_at")
          .eq("baby_id", activeBaby.id)
          .order("occurred_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("sleeps")
          .select("ended_at")
          .eq("baby_id", activeBaby.id)
          .order("ended_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("temperatures")
          .select("occurred_at, value_c")
          .eq("baby_id", activeBaby.id)
          .order("occurred_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
      ]);

      if (!active) return;

      const feedList = (feeds ?? []) as { amount: number | null; unit: string }[];
      let ml = 0;
      for (const row of feedList) {
        if (row.amount === null || row.amount === undefined) continue;
        ml += row.unit === "oz" ? Number(row.amount) * 29.5735 : Number(row.amount);
      }
      setTotalMl(Math.round(ml));
      setTotalFeeds(feedList.length);

      setTotalDiapers((diapers ?? []).length);

      let sleepMs = 0;
      for (const row of (sleeps ?? []) as SleepRow[]) {
        const s = Math.max(new Date(row.started_at).getTime(), dayStart.getTime());
        const e = Math.min(new Date(row.ended_at).getTime(), dayEnd.getTime());
        if (e > s) sleepMs += e - s;
      }
      setTotalSleepMs(sleepMs);

      setLastFeedAt((lf as { occurred_at: string } | null)?.occurred_at ?? null);
      setLastDiaperAt((ld as { occurred_at: string } | null)?.occurred_at ?? null);
      setLastWakeAt((ls as { ended_at: string } | null)?.ended_at ?? null);
      const ltRow = lt as { occurred_at: string; value_c: number } | null;
      setLastTemp(ltRow ? { occurred_at: ltRow.occurred_at, value_c: Number(ltRow.value_c) } : null);

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
        {/* Today's totals + last activity */}
        <Card className="rounded-3xl p-4 border-2 border-border bg-card shadow-none">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground text-center mb-3">
            Today
          </div>
          <div className="grid grid-cols-3 divide-x divide-border">
            <SummaryCol
              tone="text-primary"
              icon={<Milk className="w-3.5 h-3.5" />}
              label="Milk"
              loading={loading}
              value={
                <>
                  {totalMl}
                  <span className="ml-0.5 text-xs font-bold text-primary/70">ml</span>
                </>
              }
              sub={`${totalFeeds} feed${totalFeeds === 1 ? "" : "s"}`}
              lastLabel="Last fed"
              lastIso={lastFeedAt}
            />
            <SummaryCol
              tone="text-diaper-foreground"
              icon={<BabyIcon className="w-3.5 h-3.5" />}
              label="Diaper"
              loading={loading}
              value={<>{totalDiapers}</>}
              sub={`change${totalDiapers === 1 ? "" : "s"}`}
              lastLabel="Last changed"
              lastIso={lastDiaperAt}
            />
            <SummaryCol
              tone="text-sleep-foreground"
              icon={<Moon className="w-3.5 h-3.5" />}
              label="Sleep"
              loading={loading}
              value={<>{formatDuration(totalSleepMs)}</>}
              sub="today"
              lastLabel="Awake since"
              lastIso={lastWakeAt}
            />
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
                ) : lastTemp ? (
                  <div className="text-sm font-extrabold text-foreground leading-tight">
                    {lastTemp.value_c.toFixed(1)}°C
                    <span className="ml-1 text-[11px] font-medium text-muted-foreground">
                      · {timeAgo(lastTemp.occurred_at)}
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

function SummaryCol({
  tone,
  icon,
  label,
  value,
  sub,
  lastLabel,
  lastIso,
  loading,
}: {
  tone: string;
  icon: React.ReactNode;
  label: string;
  value: React.ReactNode;
  sub: string;
  lastLabel: string;
  lastIso: string | null;
  loading: boolean;
}) {
  return (
    <div className="px-2 text-center">
      <div className={`flex items-center justify-center gap-1 text-[10px] font-bold uppercase tracking-widest ${tone}`}>
        {icon} {label}
      </div>
      {loading ? (
        <div className="mx-auto mt-1.5 h-7 w-16 rounded-md bg-foreground/5 animate-pulse" />
      ) : (
        <div className={`mt-1 text-2xl font-extrabold leading-tight ${tone}`}>{value}</div>
      )}
      <div className="text-[11px] font-medium text-muted-foreground">{sub}</div>
      <div className="mt-1.5 pt-1.5 border-t border-border/60 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        {lastLabel}
      </div>
      {loading ? (
        <div className="mx-auto mt-1 h-3 w-14 rounded bg-foreground/5 animate-pulse" />
      ) : lastIso ? (
        <>
          <div className="text-[11px] font-bold text-foreground leading-tight">
            {timeAgo(lastIso)}
          </div>
          <div className="text-[10px] font-medium text-muted-foreground leading-tight">
            {fmtTime(lastIso)}
          </div>
        </>
      ) : (
        <div className="text-[11px] font-medium text-muted-foreground">—</div>
      )}
    </div>
  );
}
