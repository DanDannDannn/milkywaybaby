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
import { ChevronLeft, Milk } from "lucide-react";
import { toLocalInput, fromLocalInput } from "@/lib/time";
import { DateTimePicker } from "@/components/date-time-picker";
import { toast } from "sonner";

export const Route = createFileRoute("/log/feed")({
  head: () => ({ meta: [{ title: "Log feeding — Little Logs" }] }),
  component: LogFeed,
});

function LogFeed() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { activeBaby } = useBaby();

  const [time, setTime] = useState(toLocalInput(new Date()));
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<"ml" | "oz">("ml");
  const [type, setType] = useState<"breast" | "formula">("formula");
  const [note, setNote] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) navigate({ to: "/auth" });
    else if (!activeBaby) navigate({ to: "/onboarding" });
  }, [user, activeBaby, navigate]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!user || !activeBaby) return;
    const trimmed = amount.trim();
    let num: number | null = null;
    if (trimmed !== "") {
      const parsed = parseFloat(trimmed);
      if (isNaN(parsed) || parsed < 0) {
        toast.error("Enter a valid amount");
        return;
      }
      num = parsed;
    }
    setLoading(true);
    const { error } = await supabase.from("feedings").insert({
      baby_id: activeBaby.id,
      occurred_at: fromLocalInput(time).toISOString(),
      amount: num as number | null as number,
      unit,
      type,
      note: note.trim() || null,
      logged_by: user.id,
    });
    setLoading(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Feeding logged");
    navigate({ to: "/" });
  };

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
          <div className="flex items-center gap-2 font-semibold">
            <Milk className="w-5 h-5 text-feeding-foreground" /> Log feeding
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-md px-4 pt-4">
        <Card className="rounded-3xl p-5 border-0 shadow-sm">
          <form onSubmit={submit} className="space-y-5">
            <div className="space-y-2">
              <Label>When</Label>
              <DateTimePicker value={time} onChange={setTime} idPrefix="feed" />
            </div>

            <div className="space-y-2">
              <Label htmlFor="amount">Amount (optional)</Label>
              <div className="flex gap-2">
                <Input
                  id="amount"
                  type="number"
                  inputMode="decimal"
                  step="any"
                  min="0"
                  placeholder="e.g. 90"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className="h-11 rounded-xl text-lg flex-1 min-w-0"
                />
                <div className="flex bg-muted rounded-xl p-1 shrink-0">
                  {(["ml", "oz"] as const).map((u) => (
                    <button
                      type="button"
                      key={u}
                      onClick={() => setUnit(u)}
                      className={`px-3 sm:px-4 rounded-lg text-sm font-medium ${
                        unit === u ? "bg-card shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      {u}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label>Type</Label>
              <div className="grid grid-cols-2 gap-2">
                {(
                  [
                    { v: "breast", l: "Breast milk" },
                    { v: "formula", l: "Formula" },
                  ] as const
                ).map((opt) => (
                  <button
                    type="button"
                    key={opt.v}
                    onClick={() => setType(opt.v)}
                    className={`h-11 rounded-xl text-sm font-medium border transition-colors ${
                      type === opt.v
                        ? "bg-feeding/40 border-feeding text-feeding-foreground"
                        : "bg-card border-border text-foreground/70"
                    }`}
                  >
                    {opt.l}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="note">Note (optional)</Label>
              <Textarea
                id="note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="rounded-xl resize-none"
                placeholder="Any details…"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-12 rounded-2xl text-base font-semibold bg-feeding hover:bg-feeding/90 text-feeding-foreground"
            >
              {loading ? "Saving…" : "Save feeding"}
            </Button>
          </form>
        </Card>
      </main>
    </div>
  );
}
