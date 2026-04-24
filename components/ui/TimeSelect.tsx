"use client";

// Time options every 30 min from 7:00 AM to 10:00 PM
const TIME_OPTIONS: { value: string; label: string }[] = [];
for (let h = 7; h <= 22; h++) {
  for (let m = 0; m < 60; m += 30) {
    if (h === 22 && m > 0) break;
    const hh = String(h).padStart(2, "0");
    const mm = String(m).padStart(2, "0");
    const value = `${hh}:${mm}`;
    const displayH = h === 0 ? 12 : h > 12 ? h - 12 : h;
    const ampm = h < 12 ? "AM" : "PM";
    const label = `${displayH}:${mm} ${ampm}`;
    TIME_OPTIONS.push({ value, label });
  }
}

export function TimeSelect({
  value,
  onChange,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  className?: string;
}) {
  // If value isn't in our list (e.g. an odd time), add it as a selectable option
  const hasMatch = TIME_OPTIONS.some(o => o.value === value);

  return (
    <select
      value={value}
      onChange={e => onChange(e.target.value)}
      className={`px-3 py-2 text-sm bg-surface-container-low border border-outline-variant/30 rounded-lg text-on-surface focus:outline-none focus:border-primary ${className}`}
    >
      {!hasMatch && value && (
        <option value={value}>{value}</option>
      )}
      {TIME_OPTIONS.map(o => (
        <option key={o.value} value={o.value}>{o.label}</option>
      ))}
    </select>
  );
}
