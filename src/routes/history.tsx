import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useBaby } from "@/lib/baby-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ChevronLeft,
  ChevronRight,
  Milk,
  Baby as BabyIcon,
  Trash2,
  Loader2,
  Thermometer,
  Moon,
} from "lucide-react";
import {
  startOfWeek,
  addDays,
  startOfDay,
  endOfDay,
  sameDay,
  fmtTime,
  fmtDayLabel,
} from "@/lib/time";
import { toast } from "sonner";

export const Route = createFileRoute("/history")({
  head: () => ({ meta: [{ title: "History — Little Logs" }] }),
  component: HistoryPage,
});

interface FeedingRow {
  id: string;
  occurred_at: string;
  amount: number;
  unit: string;
  type: string;
  note: string | null;
  logged_by: string;
}
interface DiaperRow {
  id: string;
  occurred_at: string;
  type: string;
  note: string | null;
  logged_by: string;
}
interface TempRow {
  id: string;
  occurred_at: string;
  value_c: number;
  note: string | null;
  logged_by: string;
}
type Entry =
  | { kind: "feed"; data: FeedingRow }
  | { kind: "diaper"; data: DiaperRow }
  | { kind: "temp"; data: TempRow };

type Metric = "milk" | "sleep" | "temp";
type Range = "week" | "month";

function HistoryPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeBaby, loading: babyLoading } = useBaby();
  const [tab, setTab] = useState<"day" | "trends">("day");
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [entries, setEntries] = useState<Entry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [pendingDelete, setPendingDelete] = useState<Entry | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user) navigate({ to: "/auth" });
  }, [authLoading, user, navigate]);

  useEffect(() => {
    if (!activeBaby) return;
    let active = true;
    (async () => {
      setLoading(true);
      const start = startOfDay(selectedDay).toISOString();
      const end = endOfDay(selectedDay).toISOString();
      const [{ data: feeds }, { data: diapers }, { data: temps }] = await Promise.all([
        supabase
          .from("feedings")
          .select("id, occurred_at, amount, unit, type, note, logged_by")
          .eq("baby_id", activeBaby.id)
          .gte("occurred_at", start)
          .lte("occurred_at", end)
          .order("occurred_at", { ascending: false }),
        supabase
          .from("diapers")
          .select("id, occurred_at, type, note, logged_by")
          .eq("baby_id", activeBaby.id)
          .gte("occurred_at", start)
          .lte("occurred_at", end)
          .order("occurred_at", { ascending: false }),
        supabase
          .from("temperatures")
          .select("id, occurred_at, value_c, note, logged_by")
          .eq("baby_id", activeBaby.id)
          .gte("occurred_at", start)
          .lte("occurred_at", end)
          .order("occurred_at", { ascending: false }),
      ]);
      if (!active) return;
      const merged: Entry[] = [
        ...((feeds ?? []) as FeedingRow[]).map((f) => ({ kind: "feed" as const, data: f })),
        ...((diapers ?? []) as DiaperRow[]).map((d) => ({ kind: "diaper" as const, data: d })),
        ...((temps ?? []) as TempRow[]).map((t) => ({ kind: "temp" as const, data: t })),
      ].sort(
        (a, b) =>
          new Date(b.data.occurred_at).getTime() - new Date(a.data.occurred_at).getTime(),
      );
      setEntries(merged);

      const userIds = Array.from(new Set(merged.map((e) => e.data.logged_by)));
      if (userIds.length > 0) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("user_id, display_name, email")
          .in("user_id", userIds);
        const map: Record<string, string> = {};
        for (const p of (profs ?? []) as {
          user_id: string;
          display_name: string | null;
          email: string | null;
        }[]) {
          map[p.user_id] = p.display_name || p.email || "Unknown";
        }
        setProfiles(map);
      }
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [activeBaby, selectedDay]);

  const days = useMemo(
    () => Array.from({ length: 7 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );

  const summary = useMemo(() => {
    let totalMl = 0;
    let feeds = 0;
    let diapers = 0;
    let temps = 0;
    for (const e of entries) {
      if (e.kind === "feed") {
        feeds++;
        const ml = e.data.unit === "oz" ? Number(e.data.amount) * 29.5735 : Number(e.data.amount);
        totalMl += ml;
      } else if (e.kind === "diaper") diapers++;
      else temps++;
    }
    return { totalMl: Math.round(totalMl), feeds, diapers, temps };
  }, [entries]);

  const onDelete = async () => {
    if (!pendingDelete) return;
    const table =
      pendingDelete.kind === "feed"
        ? "feedings"
        : pendingDelete.kind === "diaper"
          ? "diapers"
          : "temperatures";
    const { error } = await supabase.from(table).delete().eq("id", pendingDelete.data.id);
    if (error) {
      toast.error(error.message);
    } else {
      setEntries((prev) => prev.filter((e) => e.data.id !== pendingDelete.data.id));
      toast.success("Deleted");
    }
    setPendingDelete(null);
  };

  const goToDay = (d: Date) => {
    const day = startOfDay(d);
    setSelectedDay(day);
    setWeekStart(startOfWeek(day));
    setTab("day");
  };

  if (authLoading || babyLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-screen pb-12 bg-background">
      <header className="sticky top-0 z-30 backdrop-blur bg-background/80 border-b border-border/40">
        <div className="mx-auto max-w-md px-2 h-16 flex items-center gap-2">
          <Link
            to="/"
            className="w-11 h-11 grid place-items-center rounded-full hover:bg-muted text-foreground"
          >
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <div className="font-extrabold text-lg">History</div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-4 space-y-4">
        <Tabs value={tab} onValueChange={(v) => setTab(v as "day" | "trends")}>
          <TabsList className="grid grid-cols-2 w-full h-12 rounded-full bg-muted p-1">
            <TabsTrigger value="day" className="rounded-full font-bold text-sm">
              Day
            </TabsTrigger>
            <TabsTrigger value="trends" className="rounded-full font-bold text-sm">
              Trends
            </TabsTrigger>
          </TabsList>

          <TabsContent value="day" className="mt-4 space-y-4">
            <div className="flex items-center gap-1">
              <button
                onClick={() => setWeekStart((w) => addDays(w, -7))}
                className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted"
                aria-label="Previous week"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <div className="grid grid-cols-7 flex-1 gap-1">
                {days.map((d) => {
                  const isSel = sameDay(d, selectedDay);
                  const isToday = sameDay(d, new Date());
                  return (
                    <button
                      key={d.toISOString()}
                      onClick={() => setSelectedDay(startOfDay(d))}
                      className={`flex flex-col items-center py-2 rounded-2xl transition-colors ${
                        isSel
                          ? "bg-primary text-primary-foreground shadow-sm"
                          : "hover:bg-muted text-foreground"
                      }`}
                    >
                      <span className="text-[10px] font-bold uppercase tracking-wider opacity-70">
                        {d.toLocaleDateString([], { weekday: "short" })[0]}
                      </span>
                      <span
                        className={`mt-0.5 text-base font-extrabold ${
                          isToday && !isSel ? "text-primary" : ""
                        }`}
                      >
                        {d.getDate()}
                      </span>
                    </button>
                  );
                })}
              </div>
              <button
                onClick={() => setWeekStart((w) => addDays(w, 7))}
                className="w-10 h-10 grid place-items-center rounded-full hover:bg-muted"
                aria-label="Next week"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>

            <div className="text-base font-bold text-foreground/80">
              {fmtDayLabel(selectedDay)}
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="px-3 py-1.5 rounded-full bg-feeding/40 text-feeding-foreground text-xs font-bold">
                🍼 {summary.feeds} feeds · {summary.totalMl}ml
              </span>
              <span className="px-3 py-1.5 rounded-full bg-diaper/40 text-diaper-foreground text-xs font-bold">
                🧷 {summary.diapers} diapers
              </span>
              <span className="px-3 py-1.5 rounded-full bg-temperature/40 text-temperature-foreground text-xs font-bold">
                🌡 {summary.temps} temps
              </span>
            </div>

            {loading ? (
              <div className="py-10 grid place-items-center">
                <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
              </div>
            ) : entries.length === 0 ? (
              <Card className="rounded-3xl p-8 text-center text-muted-foreground border-0 shadow-sm font-medium">
                Nothing logged for this day.
              </Card>
            ) : (
              <div className="space-y-2">
                {entries.map((e) => (
                  <Card
                    key={`${e.kind}-${e.data.id}`}
                    className={`rounded-3xl p-3 border-0 shadow-sm flex items-center gap-3 ${
                      e.kind === "feed"
                        ? "bg-feeding/30"
                        : e.kind === "diaper"
                          ? "bg-diaper/30"
                          : "bg-temperature/30"
                    }`}
                  >
                    <div className="w-11 h-11 rounded-2xl bg-card grid place-items-center shadow-sm">
                      {e.kind === "feed" ? (
                        <Milk className="w-5 h-5 text-feeding-foreground" />
                      ) : e.kind === "diaper" ? (
                        <BabyIcon className="w-5 h-5 text-diaper-foreground" />
                      ) : (
                        <Thermometer className="w-5 h-5 text-temperature-foreground" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-base font-extrabold text-foreground">
                        {e.kind === "feed"
                          ? `${Number(e.data.amount)}${e.data.unit} · ${e.data.type === "breast" ? "breast milk" : "formula"}`
                          : e.kind === "diaper"
                            ? e.data.type === "wet"
                              ? "Wet"
                              : e.data.type === "dirty"
                                ? "Dirty"
                                : "Mixed"
                            : `${Number(e.data.value_c).toFixed(1)}°C`}
                      </div>
                      <div className="text-xs font-medium text-foreground/60">
                        {fmtTime(e.data.occurred_at)}
                        {" · by "}
                        {profiles[e.data.logged_by] ?? "…"}
                        {e.data.note ? ` · ${e.data.note}` : ""}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setPendingDelete(e)}
                      className="rounded-full text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                      aria-label="Delete"
                    >
                      <Trash2 className="w-4 h-4" />
                    </Button>
                  </Card>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="trends" className="mt-4">
            {activeBaby && <TrendsView babyId={activeBaby.id} onPickDay={goToDay} />}
          </TabsContent>
        </Tabs>
      </main>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>This can't be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-full">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="rounded-full bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

interface TrendPoint {
  iso: string; // YYYY-MM-DD
  label: string;
  value: number | null;
}

function TrendsView({
  babyId,
  onPickDay,
}: {
  babyId: string;
  onPickDay: (d: Date) => void;
}) {
  const [range, setRange] = useState<Range>("week");
  const [metric, setMetric] = useState<Metric>("milk");
  const [data, setData] = useState<TrendPoint[]>([]);
  const [prevTotal, setPrevTotal] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const days = range === "week" ? 7 : 30;

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const today = startOfDay(new Date());
      const from = addDays(today, -(days - 1));
      const prevFrom = addDays(from, -days);
      const prevTo = addDays(from, -1);
      const fromIso = from.toISOString();
      const toIso = endOfDay(today).toISOString();
      const prevFromIso = prevFrom.toISOString();
      const prevToIso = endOfDay(prevTo).toISOString();

      // Build empty buckets
      const buckets: Record<string, { milk: number; sleepMs: number; temps: number[] }> = {};
      for (let i = 0; i < days; i++) {
        const d = addDays(from, i);
        const k = d.toISOString().slice(0, 10);
        buckets[k] = { milk: 0, sleepMs: 0, temps: [] };
      }

      const [{ data: feeds }, { data: sleeps }, { data: temps }] = await Promise.all([
        metric === "milk"
          ? supabase
              .from("feedings")
              .select("occurred_at, amount, unit")
              .eq("baby_id", babyId)
              .gte("occurred_at", fromIso)
              .lte("occurred_at", toIso)
          : Promise.resolve({ data: [] as { occurred_at: string; amount: number; unit: string }[] }),
        metric === "sleep"
          ? supabase
              .from("sleeps")
              .select("started_at, ended_at")
              .eq("baby_id", babyId)
              .gte("ended_at", fromIso)
              .lte("started_at", toIso)
          : Promise.resolve({ data: [] as { started_at: string; ended_at: string }[] }),
        metric === "temp"
          ? supabase
              .from("temperatures")
              .select("occurred_at, value_c")
              .eq("baby_id", babyId)
              .gte("occurred_at", fromIso)
              .lte("occurred_at", toIso)
          : Promise.resolve({ data: [] as { occurred_at: string; value_c: number }[] }),
      ]);
      if (!active) return;

      if (metric === "milk") {
        for (const f of (feeds ?? []) as { occurred_at: string; amount: number; unit: string }[]) {
          const k = new Date(f.occurred_at).toISOString().slice(0, 10);
          if (!buckets[k]) continue;
          const ml = f.unit === "oz" ? Number(f.amount) * 29.5735 : Number(f.amount);
          buckets[k].milk += ml;
        }
      } else if (metric === "sleep") {
        for (const s of (sleeps ?? []) as { started_at: string; ended_at: string }[]) {
          // Distribute duration across the day(s) it falls in
          const startMs = new Date(s.started_at).getTime();
          const endMs = new Date(s.ended_at).getTime();
          if (endMs <= startMs) continue;
          // Walk per day in our window
          for (let i = 0; i < days; i++) {
            const dayStart = addDays(from, i).getTime();
            const dayEnd = endOfDay(addDays(from, i)).getTime();
            const overlap = Math.min(endMs, dayEnd) - Math.max(startMs, dayStart);
            if (overlap > 0) {
              const k = addDays(from, i).toISOString().slice(0, 10);
              buckets[k].sleepMs += overlap;
            }
          }
        }
      } else {
        for (const t of (temps ?? []) as { occurred_at: string; value_c: number }[]) {
          const k = new Date(t.occurred_at).toISOString().slice(0, 10);
          if (!buckets[k]) continue;
          buckets[k].temps.push(Number(t.value_c));
        }
      }

      const points: TrendPoint[] = Object.keys(buckets)
        .sort()
        .map((k) => {
          const b = buckets[k];
          const d = new Date(`${k}T00:00:00`);
          let value: number | null = null;
          if (metric === "milk") value = Math.round(b.milk);
          else if (metric === "sleep") value = +(b.sleepMs / 3_600_000).toFixed(2);
          else
            value = b.temps.length
              ? +(b.temps.reduce((a, n) => a + n, 0) / b.temps.length).toFixed(1)
              : null;
          const label =
            range === "week"
              ? d.toLocaleDateString([], { weekday: "short" })
              : `${d.getMonth() + 1}/${d.getDate()}`;
          return { iso: k, label, value };
        });
      setData(points);

      // Previous period total for comparison
      let prev: number | null = null;
      if (metric === "milk") {
        const { data: pf } = await supabase
          .from("feedings")
          .select("amount, unit")
          .eq("baby_id", babyId)
          .gte("occurred_at", prevFromIso)
          .lte("occurred_at", prevToIso);
        let sum = 0;
        for (const f of (pf ?? []) as { amount: number; unit: string }[]) {
          sum += f.unit === "oz" ? Number(f.amount) * 29.5735 : Number(f.amount);
        }
        prev = Math.round(sum);
      } else if (metric === "sleep") {
        const { data: ps } = await supabase
          .from("sleeps")
          .select("started_at, ended_at")
          .eq("baby_id", babyId)
          .gte("ended_at", prevFromIso)
          .lte("started_at", prevToIso);
        let ms = 0;
        const winStart = prevFrom.getTime();
        const winEnd = endOfDay(prevTo).getTime();
        for (const s of (ps ?? []) as { started_at: string; ended_at: string }[]) {
          const a = Math.max(new Date(s.started_at).getTime(), winStart);
          const b = Math.min(new Date(s.ended_at).getTime(), winEnd);
          if (b > a) ms += b - a;
        }
        prev = +(ms / 3_600_000).toFixed(2);
      } else {
        const { data: pt } = await supabase
          .from("temperatures")
          .select("value_c")
          .eq("baby_id", babyId)
          .gte("occurred_at", prevFromIso)
          .lte("occurred_at", prevToIso);
        const vs = ((pt ?? []) as { value_c: number }[]).map((t) => Number(t.value_c));
        prev = vs.length ? +(vs.reduce((a, n) => a + n, 0) / vs.length).toFixed(1) : null;
      }
      if (!active) return;
      setPrevTotal(prev);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, [babyId, metric, days, range]);

  const total = useMemo(() => {
    if (metric === "temp") {
      const vs = data.map((d) => d.value).filter((v): v is number => v !== null);
      if (!vs.length) return null;
      return +(vs.reduce((a, n) => a + n, 0) / vs.length).toFixed(1);
    }
    return data.reduce((a, d) => a + (d.value ?? 0), 0);
  }, [data, metric]);

  const metricMeta: Record<Metric, { label: string; unit: string; color: string; icon: typeof Milk }> = {
    milk: { label: "Milk", unit: "ml", color: "hsl(var(--primary))", icon: Milk },
    sleep: { label: "Sleep", unit: "h", color: "hsl(var(--sleep-foreground))", icon: Moon },
    temp: { label: "Temperature", unit: "°C", color: "hsl(var(--temperature-foreground))", icon: Thermometer },
  };
  const meta = metricMeta[metric];
  const Icon = meta.icon;

  return (
    <div className="space-y-4">
      {/* Range selector */}
      <div className="flex gap-1 p-1 rounded-full bg-muted w-fit">
        {(["week", "month"] as Range[]).map((r) => (
          <button
            key={r}
            onClick={() => setRange(r)}
            className={`px-4 py-1.5 rounded-full text-xs font-bold capitalize transition-colors ${
              range === r ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
            }`}
          >
            {r === "week" ? "7 days" : "30 days"}
          </button>
        ))}
      </div>

      {/* Metric selector */}
      <div className="grid grid-cols-3 gap-2">
        {(Object.keys(metricMeta) as Metric[]).map((m) => {
          const I = metricMeta[m].icon;
          const active = m === metric;
          return (
            <button
              key={m}
              onClick={() => setMetric(m)}
              className={`flex items-center justify-center gap-1.5 h-10 rounded-2xl text-sm font-bold border-2 transition-colors ${
                active
                  ? "bg-foreground text-background border-foreground"
                  : "bg-card text-foreground border-border hover:bg-muted"
              }`}
            >
              <I className="w-4 h-4" /> {metricMeta[m].label}
            </button>
          );
        })}
      </div>

      <Card className="rounded-3xl p-4 border-0 shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div
              className="w-9 h-9 rounded-2xl grid place-items-center"
              style={{ backgroundColor: `color-mix(in oklab, ${meta.color} 18%, transparent)` }}
            >
              <Icon className="w-4 h-4" style={{ color: meta.color }} />
            </div>
            <div>
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {range === "week" ? "Last 7 days" : "Last 30 days"} · {metric === "temp" ? "avg" : "total"}
              </div>
              <div className="text-2xl font-extrabold text-foreground leading-tight">
                {total === null || total === 0 ? "—" : total}
                <span className="ml-1 text-sm font-bold text-muted-foreground">{meta.unit}</span>
              </div>
              {(() => {
                const cur = total;
                const prev = prevTotal;
                if (cur === null || prev === null || prev === 0 || cur === 0) {
                  return (
                    <div className="mt-0.5 text-[11px] font-bold text-muted-foreground">
                      No data for previous {range === "week" ? "week" : "month"}
                    </div>
                  );
                }
                const diff = metric === "temp" ? +(cur - prev).toFixed(1) : cur - prev;
                const pct = Math.round(((cur - prev) / Math.abs(prev)) * 100);
                const up = diff > 0;
                const flat = diff === 0;
                const goodUp = metric !== "temp"; // more milk/sleep = good; for temp neutral
                const tone = flat
                  ? "text-muted-foreground"
                  : metric === "temp"
                    ? "text-foreground/70"
                    : (up === goodUp ? "text-emerald-600" : "text-rose-600");
                const arrow = flat ? "→" : up ? "▲" : "▼";
                const diffLabel =
                  metric === "temp"
                    ? `${up ? "+" : ""}${diff}${meta.unit}`
                    : `${up ? "+" : ""}${pct}%`;
                return (
                  <div className={`mt-0.5 text-[11px] font-bold ${tone}`}>
                    {arrow} {diffLabel} vs last {range === "week" ? "week" : "month"}
                  </div>
                );
              })()}
            </div>
          </div>
        </div>

        {loading ? (
          <div className="h-56 grid place-items-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <div className="h-56 -ml-2">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart
                data={data}
                margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
                onClick={(state) => {
                  const idx = state?.activeTooltipIndex;
                  if (typeof idx === "number" && data[idx]) {
                    onPickDay(new Date(`${data[idx].iso}T00:00:00`));
                  }
                }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
                <XAxis
                  dataKey="label"
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  interval={range === "week" ? 0 : "preserveStartEnd"}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
                  axisLine={false}
                  tickLine={false}
                  width={36}
                  domain={metric === "temp" ? ["auto", "auto"] : [0, "auto"]}
                />
                <Tooltip
                  cursor={{ stroke: meta.color, strokeOpacity: 0.3 }}
                  contentStyle={{
                    borderRadius: 12,
                    border: "1px solid hsl(var(--border))",
                    background: "hsl(var(--card))",
                    fontSize: 12,
                  }}
                  formatter={(v: number) => [
                    `${v}${meta.unit}`,
                    meta.label,
                  ]}
                  labelFormatter={(_, payload) => {
                    const p = payload?.[0]?.payload as TrendPoint | undefined;
                    if (!p) return "";
                    return new Date(`${p.iso}T00:00:00`).toLocaleDateString([], {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    });
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="value"
                  stroke={meta.color}
                  strokeWidth={2.5}
                  dot={{ r: 4, fill: meta.color, strokeWidth: 0, cursor: "pointer" }}
                  activeDot={{ r: 6, cursor: "pointer" }}
                  connectNulls
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}

        <p className="mt-2 text-[11px] text-center text-muted-foreground">
          Tap a point to see that day's details
        </p>
      </Card>

      {/* Per-day list */}
      <div className="space-y-1.5">
        {[...data].reverse().map((p) => (
          <button
            key={p.iso}
            onClick={() => onPickDay(new Date(`${p.iso}T00:00:00`))}
            className="w-full flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-card hover:bg-muted transition-colors text-left"
          >
            <div className="flex items-center gap-3 min-w-0">
              <div className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground w-10 shrink-0">
                {p.label}
              </div>
              <div className="text-sm font-bold text-foreground truncate">
                {new Date(`${p.iso}T00:00:00`).toLocaleDateString([], {
                  month: "short",
                  day: "numeric",
                })}
              </div>
            </div>
            <div className="flex items-center gap-2 shrink-0">
              <span className="text-sm font-extrabold text-foreground">
                {p.value === null ? "—" : `${p.value}${meta.unit}`}
              </span>
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
