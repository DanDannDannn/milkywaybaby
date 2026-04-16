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
import { ChevronLeft, Thermometer } from "lucide-react";
import { toLocalInput, fromLocalInput } from "@/lib/time";
import { DateTimePicker } from "@/components/date-time-picker";
import { toast } from "sonner";

export const Route = createFileRoute("/log/temp")({
  head: () => ({ meta: [{ title: "Log temperature — Little Logs" }] }),
  component: LogTemp,
});

function LogTemp() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeBaby } = useBaby();

  const [time, setTime] = useState(toLocalInput(new Date()));
  const [value, setValue] = useState("");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) navigate({ to: "/auth" });
    else if (!activeBaby) navigate({ to: "/onboarding" });
  }, [user, activeBaby, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !activeBaby) return;
    const num = parseFloat(value);
    if (isNaN(num) || num < 30 || num > 45) {
      toast.error("Enter a temperature in °C (30–45)");
      return;
    }
    setLoading(true);
    const { error } = await supabase.from("temperatures").insert({
      baby_id: activeBaby.id,
      occurred_at: fromLocalInput(time).toISOString(),
      value_c: num,
      note: note.trim() || null,
      logged_by: user.id,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Temperature logged");
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
            <Thermometer className="w-5 h-5 text-temperature-foreground" /> Log temperature
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-4">
        <Card className="rounded-3xl p-5 border-0 shadow-sm">
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label htmlFor="temp-date" className="text-base font-bold">
                When
              </Label>
              <DateTimePicker value={time} onChange={setTime} idPrefix="temp" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="value" className="text-base font-bold">
                Temperature (°C)
              </Label>
              <Input
                id="value"
                type="number"
                inputMode="decimal"
                step="0.1"
                min="30"
                max="45"
                required
                placeholder="36.8"
                value={value}
                onChange={(e) => setValue(e.target.value)}
                className="h-14 rounded-2xl text-2xl font-extrabold text-center"
              />
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
                placeholder="Method (forehead, ear), how baby seems…"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-14 rounded-full text-base font-extrabold bg-temperature hover:bg-temperature/90 text-temperature-foreground"
            >
              {loading ? "Saving…" : "Save temperature"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
