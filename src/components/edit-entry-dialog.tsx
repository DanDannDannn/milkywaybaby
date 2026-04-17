import { useEffect, useState, type FormEvent } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { DateTimePicker } from "@/components/date-time-picker";
import { toLocalInput, fromLocalInput } from "@/lib/time";
import { toast } from "sonner";

export type EditableEntry =
  | {
      kind: "feed";
      id: string;
      occurred_at: string;
      amount: number | null;
      unit: "ml" | "oz";
      type: "breast" | "formula";
      note: string | null;
    }
  | {
      kind: "diaper";
      id: string;
      occurred_at: string;
      type: "wet" | "dirty" | "mixed";
      note: string | null;
    }
  | {
      kind: "temp";
      id: string;
      occurred_at: string;
      value_c: number;
      note: string | null;
    };

interface Props {
  entry: EditableEntry | null;
  onClose: () => void;
  onSaved: () => void;
}

export function EditEntryDialog({ entry, onClose, onSaved }: Props) {
  const [time, setTime] = useState("");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("");
  const [unit, setUnit] = useState<"ml" | "oz">("ml");
  const [feedType, setFeedType] = useState<"breast" | "formula">("formula");
  const [diaperType, setDiaperType] = useState<"wet" | "dirty" | "mixed">("wet");
  const [tempC, setTempC] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!entry) return;
    setTime(toLocalInput(new Date(entry.occurred_at)));
    setNote(entry.note ?? "");
    if (entry.kind === "feed") {
      setAmount(entry.amount === null || entry.amount === undefined ? "" : String(entry.amount));
      setUnit(entry.unit);
      setFeedType(entry.type);
    } else if (entry.kind === "diaper") {
      setDiaperType(entry.type);
    } else {
      setTempC(String(entry.value_c));
    }
  }, [entry]);

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (!entry) return;
    const occurred_at = fromLocalInput(time).toISOString();
    const trimmedNote = note.trim() || null;
    setSaving(true);
    let error: { message: string } | null = null;
    if (entry.kind === "feed") {
      let num: number | null = null;
      const t = amount.trim();
      if (t !== "") {
        const parsed = parseFloat(t);
        if (isNaN(parsed) || parsed < 0) {
          toast.error("Enter a valid amount");
          setSaving(false);
          return;
        }
        num = parsed;
      }
      ({ error } = await supabase
        .from("feedings")
        .update({
          occurred_at,
          amount: num as unknown as number,
          unit,
          type: feedType,
          note: trimmedNote,
        })
        .eq("id", entry.id));
    } else if (entry.kind === "diaper") {
      ({ error } = await supabase
        .from("diapers")
        .update({ occurred_at, type: diaperType, note: trimmedNote })
        .eq("id", entry.id));
    } else {
      const num = parseFloat(tempC);
      if (isNaN(num) || num < 30 || num > 45) {
        toast.error("Enter a temperature in °C (30–45)");
        setSaving(false);
        return;
      }
      ({ error } = await supabase
        .from("temperatures")
        .update({ occurred_at, value_c: num, note: trimmedNote })
        .eq("id", entry.id));
    }
    setSaving(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Updated");
    onSaved();
    onClose();
  };

  const title =
    entry?.kind === "feed"
      ? "Edit feeding"
      : entry?.kind === "diaper"
        ? "Edit diaper"
        : "Edit temperature";

  return (
    <Dialog open={!!entry} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="rounded-3xl max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        {entry && (
          <form onSubmit={submit} className="space-y-4">
            <div className="space-y-2">
              <Label>When</Label>
              <DateTimePicker value={time} onChange={setTime} idPrefix="edit" />
            </div>

            {entry.kind === "feed" && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="edit-amount">Amount (optional)</Label>
                  <div className="flex gap-2">
                    <Input
                      id="edit-amount"
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
                        onClick={() => setFeedType(opt.v)}
                        className={`h-11 rounded-xl text-sm font-medium border transition-colors ${
                          feedType === opt.v
                            ? "bg-feeding/40 border-feeding text-feeding-foreground"
                            : "bg-card border-border text-foreground/70"
                        }`}
                      >
                        {opt.l}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            )}

            {entry.kind === "diaper" && (
              <div className="space-y-2">
                <Label>Type</Label>
                <div className="grid grid-cols-3 gap-2">
                  {(
                    [
                      { v: "wet", l: "Wet", e: "💧" },
                      { v: "dirty", l: "Dirty", e: "💩" },
                      { v: "mixed", l: "Mixed", e: "🌀" },
                    ] as const
                  ).map((opt) => (
                    <button
                      type="button"
                      key={opt.v}
                      onClick={() => setDiaperType(opt.v)}
                      className={`h-16 rounded-2xl text-sm font-medium border flex flex-col items-center justify-center gap-1 transition-colors ${
                        diaperType === opt.v
                          ? "bg-diaper/40 border-diaper text-diaper-foreground"
                          : "bg-card border-border text-foreground/70"
                      }`}
                    >
                      <span className="text-xl leading-none">{opt.e}</span>
                      {opt.l}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {entry.kind === "temp" && (
              <div className="space-y-2">
                <Label htmlFor="edit-temp">Temperature (°C)</Label>
                <Input
                  id="edit-temp"
                  type="number"
                  inputMode="decimal"
                  step="0.1"
                  min="30"
                  max="45"
                  value={tempC}
                  onChange={(e) => setTempC(e.target.value)}
                  className="h-14 rounded-2xl text-2xl font-extrabold text-center"
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="edit-note">Note (optional)</Label>
              <Textarea
                id="edit-note"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={3}
                className="rounded-xl resize-none"
              />
            </div>

            <DialogFooter className="gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={onClose}
                className="rounded-full"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={saving}
                className="rounded-full bg-primary hover:bg-primary/90"
              >
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
