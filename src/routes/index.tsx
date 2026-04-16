import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import { useBaby } from "@/lib/baby-context";
import { supabase } from "@/integrations/supabase/client";
import { AppHeader } from "@/components/app-header";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Milk, Baby as BabyIcon, History, Loader2, Thermometer } from "lucide-react";
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
interface LastTemp {
  occurred_at: string;
  value_c: number;
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
  const [lastTemp, setLastTemp] = useState<LastTemp | null>(null);
  const [todayMl, setTodayMl] = useState(0);
  const [todayCount, setTodayCount] = useState(0);
  const [tempLoggedToday, setTempLoggedToday] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!activeBaby) return;
    let active = true;
    (async () => {
      setLoading(true);
      const dayStart = startOfDay(new Date()).toISOString();
      const dayEnd = endOfDay(new Date()).toISOString();

      const [{ data: f }, { data: d }, { data: t }, { data: todayFeeds }, { data: todayTemps }] =
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
            .from("temperatures")
            .select("occurred_at, value_c")
            .eq("baby_id", activeBaby.id)
            .order("occurred_at", { ascending: false })
            .limit(1)
            .maybeSingle(),
          supabase
            .from("feedings")
            .select("amount, unit")
            .eq("baby_id", activeBaby.id)
            .gte("occurred_at", dayStart)
            .lte("occurred_at", dayEnd),
          supabase
            .from("temperatures")
            .select("id")
            .eq("baby_id", activeBaby.id)
            .gte("occurred_at", dayStart)
            .lte("occurred_at", dayEnd)
            .limit(1),
        ]);

      if (!active) return;

      setLastFeed(f as LastFeeding | null);
      setLastDiaper(d as LastDiaper | null);
      setLastTemp(t as LastTemp | null);

      let total = 0;
      const list = (todayFeeds ?? []) as { amount: number; unit: string }[];
      for (const row of list) {
        total += row.unit === "oz" ? Number(row.amount) * 29.5735 : Number(row.amount);
      }
      setTodayMl(Math.round(total));
      setTodayCount(list.length);
      setTempLoggedToday(((todayTemps ?? []) as unknown[]).length > 0);
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
        {/* Today's milk total — hero */}
        <Card className="rounded-[2rem] p-6 border-0 shadow-md bg-gradient-to-br from-primary/25 to-secondary/60">
          <div className="text-xs font-bold uppercase tracking-widest text-foreground/60">
            Today's milk
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            {loading ? (
              <div className="h-12 w-32 rounded-xl bg-foreground/10 animate-pulse" />
            ) : (
              <>
                <div className="text-5xl font-extrabold text-foreground tracking-tight">
                  {todayMl}
                </div>
                <div className="text-xl font-bold text-foreground/70">ml</div>
              </>
            )}
          </div>
          <div className="mt-1 text-sm font-medium text-foreground/60">
            {todayCount} feed{todayCount === 1 ? "" : "s"} so far
          </div>
        </Card>

        {/* Temperature task card */}
        {!loading && !tempLoggedToday && (
          <Link
            to="/log/temp"
            className="block rounded-3xl p-4 bg-temperature/40 border border-temperature/60 shadow-sm hover:bg-temperature/55 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-2xl bg-card grid place-items-center shadow-sm">
                <Thermometer className="w-6 h-6 text-temperature-foreground" />
              </div>
              <div className="flex-1">
                <div className="text-base font-bold text-foreground">Today's task</div>
                <div className="text-sm text-foreground/70">Record baby's temperature</div>
              </div>
              <div className="text-2xl">→</div>
            </div>
          </Link>
        )}

        {/* Status cards */}
        <div className="grid grid-cols-2 gap-3">
          <Card className="rounded-3xl p-4 border-0 bg-feeding/40 shadow-sm">
            <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-feeding-foreground/80">
              <Milk className="w-4 h-4" /> Last feed
            </div>
            {loading ? (
              <div className="mt-3 h-10 rounded-md bg-foreground/5 animate-pulse" />
            ) : lastFeed ? (
              <>
                <div className="mt-2 text-lg font-extrabold text-foreground">
                  {timeAgo(lastFeed.occurred_at)}
                </div>
                <div className="text-xs font-medium text-foreground/70 capitalize">
                  {Number(lastFeed.amount)}
                  {lastFeed.unit} · {lastFeed.type === "breast" ? "breast milk" : "formula"}
                </div>
              </>
            ) : (
              <div className="mt-2 text-sm text-foreground/60">No feeds yet</div>
            )}
          </Card>

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

          {lastTemp && (
            <Card className="rounded-3xl p-4 border-0 bg-temperature/30 shadow-sm col-span-2">
              <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-temperature-foreground/80">
                <Thermometer className="w-4 h-4" /> Last temperature
              </div>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="text-2xl font-extrabold text-foreground">
                  {Number(lastTemp.value_c).toFixed(1)}°C
                </span>
                <span className="text-sm font-medium text-foreground/60">
                  {timeAgo(lastTemp.occurred_at)}
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
            variant="outline"
            className="h-16 rounded-full text-lg font-bold border-2 border-temperature bg-temperature/20 hover:bg-temperature/35 text-foreground"
          >
            <Link to="/log/temp">
              <Thermometer className="!w-6 !h-6" /> Temperature
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
