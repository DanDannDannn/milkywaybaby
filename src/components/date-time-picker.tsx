import { Input } from "@/components/ui/input";

interface DateTimePickerProps {
  /** Combined value in `YYYY-MM-DDTHH:mm` (local) format. */
  value: string;
  onChange: (next: string) => void;
  className?: string;
  idPrefix?: string;
}

/**
 * Two-field date + time picker that reads/writes a single
 * `YYYY-MM-DDTHH:mm` local string (same shape as <input type="datetime-local">).
 */
export function DateTimePicker({
  value,
  onChange,
  className,
  idPrefix = "dt",
}: DateTimePickerProps) {
  const [datePart, timePart] = value.includes("T") ? value.split("T") : [value, "00:00"];

  const setDate = (d: string) => {
    if (!d) return;
    onChange(`${d}T${timePart || "00:00"}`);
  };
  const setTime = (t: string) => {
    if (!t) return;
    onChange(`${datePart}T${t}`);
  };

  return (
    <div className={`grid grid-cols-[1fr_auto] gap-2 ${className ?? ""}`}>
      <Input
        id={`${idPrefix}-date`}
        type="date"
        value={datePart}
        onChange={(e) => setDate(e.target.value)}
        className="h-12 rounded-2xl text-base"
      />
      <Input
        id={`${idPrefix}-time`}
        type="time"
        value={timePart.slice(0, 5)}
        onChange={(e) => setTime(e.target.value)}
        className="h-12 rounded-2xl text-base w-[7.5rem]"
      />
    </div>
  );
}
