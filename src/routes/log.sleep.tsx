import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { useBaby } from "@/lib/baby-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Moon } from "lucide-react";
import { toLocalInput, fromLocalInput } from "@/lib/time";
import { DateTimePicker } from "@/components/date-time-picker";
import { toast } from "sonner";

export const Route = createFileRoute("/log/sleep")({
  head: () => ({ meta: [{ title: "Log sleep — Little Logs" }] }),
  component: LogSleep,
});

function formatDuration(ms: number) {
  if (ms <= 0) return "0m";
  const mins = Math.round(ms / 60000);
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  if (h === 0) return `${m}m`;
  if (m === 0) return `${h}h`;
  return `${h}h ${m}m`;
}

function LogSleep() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeBaby } = useBaby();

  const now = new Date();
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const [start, setStart] = useState(toLocalInput(oneHourAgo));
  const [end, setEnd] = useState(toLocalInput(now));
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) navigate({ to: "/auth" });
    else if (!activeBaby) navigate({ to: "/onboarding" });
  }, [user, activeBaby, navigate]);

  const startDate = fromLocalInput(start);
  const endDate = fromLocalInput(end);
  const duration = endDate.getTime() - startDate.getTime();

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !activeBaby) return;
    if (duration <= 0) {
      toast.error("Awake time must be after sleep time");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("sleeps").insert({
      baby_id: activeBaby.id,
      started_at: startDate.toISOString(),
      ended_at: endDate.toISOString(),
      note: note.trim() || null,
      logged_by: user.id,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Sleep logged");
    navigate({ to: "/" });
  };

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
          <div className="flex items-center gap-2 font-extrabold text-lg">
            <Moon className="w-5 h-5 text-sleep-foreground" /> Log sleep
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-4">
        <Card className="rounded-3xl p-5 border-0 shadow-sm">
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="start-date" className="text-base font-bold">
                Sleep time
              </Label>
              <DateTimePicker value={start} onChange={setStart} idPrefix="start" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="end-date" className="text-base font-bold">
                Awake time
              </Label>
              <DateTimePicker value={end} onChange={setEnd} idPrefix="end" />
            </div>

            <div className="rounded-2xl bg-sleep/30 p-4 text-center">
              <div className="text-xs font-bold uppercase tracking-widest text-foreground/60">
                Duration
              </div>
              <div className="mt-1 text-3xl font-extrabold text-foreground">
                {duration > 0 ? formatDuration(duration) : "—"}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note" className="text-base font-bold">
                Note (optional)
              </Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="rounded-2xl resize-none text-base"
                placeholder="Nap location, mood…"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-full text-base font-extrabold bg-sleep hover:bg-sleep/90 text-sleep-foreground"
            >
              {loading ? "Saving…" : "Save sleep"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
