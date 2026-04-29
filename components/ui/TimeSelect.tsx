"use client";

import { useMemo } from "react";

const HOURS_12 = Array.from({ length: 12 }, (_, i) => i + 1);
const MINUTE_STEPS = Array.from({ length: 12 }, (_, i) => i * 5); // 0, 5, 10, … 55

function parse(value: string): { hour12: number; minute: number; period: "AM" | "PM" } {
  if (!value) return { hour12: 9, minute: 0, period: "AM" };
  const [hStr, mStr] = value.split(":");
  const h24 = Number.isFinite(Number(hStr)) ? Number(hStr) : 9;
  const m = Number.isFinite(Number(mStr)) ? Number(mStr) : 0;
  const period: "AM" | "PM" = h24 >= 12 ? "PM" : "AM";
  const mod = h24 % 12;
  return { hour12: mod === 0 ? 12 : mod, minute: m, period };
}

function format(hour12: number, minute: number, period: "AM" | "PM"): string {
  let h24 = hour12 % 12;
  if (period === "PM") h24 += 12;
  return `${String(h24).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/**
 * Compact 12-hour time picker. Stores/emits 24-hour `HH:mm` so it's a
 * drop-in replacement for `<input type="time">` and the legacy native-select
 * version of this component.
 */
export function TimeSelect({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  const { hour12, minute, period } = parse(value);

  // Keep odd minute values (e.g. 23) selectable alongside the 5-minute grid.
  const minuteOptions = useMemo(() => {
    const set = new Set<number>(MINUTE_STEPS);
    set.add(minute);
    return [...set].sort((a, b) => a - b);
  }, [minute]);

  const update = (h: number, m: number, p: "AM" | "PM") => onChange(format(h, m, p));

  const segCls =
    "appearance-none bg-transparent text-sm font-medium text-on-surface focus:outline-none cursor-pointer tabular-nums text-center pr-0";

  return (
    <div
      className={`inline-flex items-center gap-1 h-10 px-2.5 rounded-lg border border-outline-variant/30 bg-surface-container-low focus-within:border-primary transition-colors ${className}`}
    >
      <select
        aria-label="Hour"
        className={`${segCls} w-7`}
        value={hour12}
        onChange={e => update(Number(e.target.value), minute, period)}
      >
        {HOURS_12.map(h => (
          <option key={h} value={h}>
            {h}
          </option>
        ))}
      </select>
      <span className="text-on-surface-variant text-sm select-none">:</span>
      <select
        aria-label="Minute"
        className={`${segCls} w-8`}
        value={minute}
        onChange={e => update(hour12, Number(e.target.value), period)}
      >
        {minuteOptions.map(m => (
          <option key={m} value={m}>
            {String(m).padStart(2, "0")}
          </option>
        ))}
      </select>
      <div className="ml-1 flex items-center bg-surface-container rounded-md p-0.5 shrink-0">
        {(["AM", "PM"] as const).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => update(hour12, minute, p)}
            className={`px-2 py-0.5 text-[11px] font-semibold rounded transition-colors ${
              period === p
                ? "bg-on-surface text-surface"
                : "text-on-surface-variant hover:text-on-surface"
            }`}
          >
            {p}
          </button>
        ))}
      </div>
    </div>
  );
}
