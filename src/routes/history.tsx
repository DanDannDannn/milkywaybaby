import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useBaby } from "@/lib/baby-context";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ChevronLeft, ChevronRight, Milk, Baby as BabyIcon, Trash2, Loader2 } from "lucide-react";
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
}
interface DiaperRow {
  id: string;
  occurred_at: string;
  type: string;
  note: string | null;
}
type Entry =
  | { kind: "feed"; data: FeedingRow }
  | { kind: "diaper"; data: DiaperRow };

function HistoryPage() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeBaby, loading: babyLoading } = useBaby();
  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => startOfDay(new Date()));
  const [entries, setEntries] = useState<Entry[]>([]);
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
      const [{ data: feeds }, { data: diapers }] = await Promise.all([
        supabase
          .from("feedings")
          .select("id, occurred_at, amount, unit, type, note")
          .eq("baby_id", activeBaby.id)
          .gte("occurred_at", start)
          .lte("occurred_at", end)
          .order("occurred_at", { ascending: false }),
        supabase
          .from("diapers")
          .select("id, occurred_at, type, note")
          .eq("baby_id", activeBaby.id)
          .gte("occurred_at", start)
          .lte("occurred_at", end)
          .order("occurred_at", { ascending: false }),
      ]);
      if (!active) return;
      const merged: Entry[] = [
        ...((feeds ?? []) as FeedingRow[]).map((f) => ({ kind: "feed" as const, data: f })),
        ...((diapers ?? []) as DiaperRow[]).map((d) => ({ kind: "diaper" as const, data: d })),
      ].sort(
        (a, b) =>
          new Date(b.data.occurred_at).getTime() - new Date(a.data.occurred_at).getTime(),
      );
      setEntries(merged);
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
    for (const e of entries) {
      if (e.kind === "feed") {
        feeds++;
        const ml = e.data.unit === "oz" ? Number(e.data.amount) * 29.5735 : Number(e.data.amount);
        totalMl += ml;
      } else diapers++;
    }
    return { totalMl: Math.round(totalMl), feeds, diapers };
  }, [entries]);

  const onDelete = async () => {
    if (!pendingDelete) return;
    const table = pendingDelete.kind === "feed" ? "feedings" : "diapers";
    const { error } = await supabase.from(table).delete().eq("id", pendingDelete.data.id);
    if (error) {
      toast.error(error.message);
    } else {
      setEntries((prev) => prev.filter((e) => e.data.id !== pendingDelete.data.id));
      toast.success("Deleted");
    }
    setPendingDelete(null);
  };

  if (authLoading || babyLoading) {
    return (
      <div className="min-h-screen grid place-items-center">
        <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

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
          <div className="font-semibold">History</div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-4 space-y-4">
        {/* Weekly strip */}
        <div className="flex items-center gap-1">
          <button
            onClick={() => setWeekStart((w) => addDays(w, -7))}
            className="w-9 h-9 grid place-items-center rounded-full hover:bg-muted"
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
                  <span className="text-[10px] uppercase tracking-wider opacity-70">
                    {d.toLocaleDateString([], { weekday: "short" })[0]}
                  </span>
                  <span
                    className={`mt-0.5 text-sm font-semibold ${
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
            className="w-9 h-9 grid place-items-center rounded-full hover:bg-muted"
            aria-label="Next week"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="text-sm font-medium text-foreground/80">{fmtDayLabel(selectedDay)}</div>

        <div className="flex flex-wrap gap-2">
          <span className="px-3 py-1 rounded-full bg-feeding/40 text-feeding-foreground text-xs font-medium">
            🍼 {summary.feeds} feeds · {summary.totalMl}ml
          </span>
          <span className="px-3 py-1 rounded-full bg-diaper/40 text-diaper-foreground text-xs font-medium">
            🧷 {summary.diapers} diapers
          </span>
        </div>

        {loading ? (
          <div className="py-10 grid place-items-center">
            <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
          </div>
        ) : entries.length === 0 ? (
          <Card className="rounded-3xl p-8 text-center text-muted-foreground border-0 shadow-sm">
            Nothing logged for this day.
          </Card>
        ) : (
          <div className="space-y-2">
            {entries.map((e) => (
              <Card
                key={`${e.kind}-${e.data.id}`}
                className={`rounded-2xl p-3 border-0 shadow-sm flex items-center gap-3 ${
                  e.kind === "feed" ? "bg-feeding/30" : "bg-diaper/30"
                }`}
              >
                <div className="w-10 h-10 rounded-full bg-card grid place-items-center shadow-sm">
                  {e.kind === "feed" ? (
                    <Milk className="w-5 h-5 text-feeding-foreground" />
                  ) : (
                    <BabyIcon className="w-5 h-5 text-diaper-foreground" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-sm font-medium text-foreground">
                    {e.kind === "feed"
                      ? `${Number(e.data.amount)}${e.data.unit} · ${e.data.type === "breast" ? "breast milk" : "formula"}`
                      : e.data.type === "wet"
                        ? "Wet"
                        : e.data.type === "dirty"
                          ? "Dirty"
                          : "Mixed"}
                  </div>
                  <div className="text-xs text-foreground/60">
                    {fmtTime(e.data.occurred_at)}
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
      </main>

      <AlertDialog
        open={!!pendingDelete}
        onOpenChange={(open) => !open && setPendingDelete(null)}
      >
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete this entry?</AlertDialogTitle>
            <AlertDialogDescription>
              This can't be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={onDelete}
              className="rounded-xl bg-destructive hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
