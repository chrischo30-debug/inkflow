import { BookingState } from "@/lib/types";

const stateConfig: Record<BookingState, { label: string; colorClass: string }> = {
  inquiry:   { label: "Submission", colorClass: "bg-outline-variant/30 text-on-surface-variant border-outline-variant/50" },
  follow_up: { label: "Follow Ups", colorClass: "bg-secondary-container/40 text-on-secondary-container border-secondary-container/60" },
  accepted:  { label: "Accepted",  colorClass: "bg-surface-tint/20 text-surface-tint border-surface-tint/30" },
  confirmed: { label: "Booked",    colorClass: "bg-primary/10 text-primary border-primary/20" },
  completed: { label: "Completed", colorClass: "bg-surface-container-highest text-on-surface-variant border-outline-variant/30" },
  rejected:  { label: "Rejected",  colorClass: "bg-destructive/10 text-destructive border-destructive/20" },
  cancelled: { label: "Cancelled", colorClass: "bg-destructive/10 text-destructive border-destructive/20" },
};

export function StateBadge({ state }: { state: BookingState }) {
  const config = stateConfig[state] ?? stateConfig.inquiry;

  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${config.colorClass}`}>
      {config.label}
    </span>
  );
}
